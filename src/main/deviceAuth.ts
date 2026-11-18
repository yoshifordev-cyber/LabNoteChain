import { execFile } from 'child_process'
import { randomBytes } from 'crypto'
import { unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import { systemPreferences } from 'electron'

const execFileAsync = promisify(execFile)

export type DeviceAuthMethod = 'windows-hello' | 'touch-id' | 'unavailable'

/** PowerShell 5 は BOM なし UTF-8 をシステムコードページで読み、日本語で構文が壊れる */
function writePs1Utf8Bom(path: string, body: string): void {
  writeFileSync(path, '\uFEFF' + body, 'utf8')
}

function mapHelloResult(code: string): string {
  switch (code) {
    case 'Canceled':
      return '本人確認がキャンセルされました。'
    case 'DeviceNotPresent':
      return 'Windows Hello 対応デバイスがありません。'
    case 'NotConfiguredForUser':
      return 'この Windows アカウントに Windows Hello（顔・指紋・PIN）が設定されていません。'
    case 'DisabledByPolicy':
      return 'Windows Hello がポリシーで無効です。'
    case 'DeviceBusy':
      return '認証デバイスが使用中です。しばらくして再試行してください。'
    case 'RetriesExhausted':
      return '本人確認の再試行回数を超えました。'
    default:
      return `本人確認に失敗しました（${code}）。`
  }
}

const PS_HELPER = `
param(
  [Parameter(Mandatory = $true)][ValidateSet('check','verify')][string]$Mode,
  [string]$Reason = 'Lab notebook'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } |
  Select-Object -First 1
if (-not $asTask) { throw 'AsTask not found' }
function Await-WinRT($asyncOp, [Type]$resultType) {
  $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($asyncOp))
  $null = $task.Wait()
  if ($task.IsFaulted) { throw $task.Exception.InnerException }
  return $task.Result
}
[void][Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]
$availType = [Windows.Security.Credentials.UI.UserConsentVerifierAvailability]
$avail = Await-WinRT ([Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()) $availType
if ($Mode -eq 'check') {
  Write-Output ('AVAIL:' + $avail.ToString())
  exit 0
}
if ($avail.ToString() -ne 'Available') {
  Write-Output ('AVAIL:' + $avail.ToString())
  exit 0
}
$resultType = [Windows.Security.Credentials.UI.UserConsentVerificationResult]
$verifyResult = Await-WinRT ([Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync($Reason)) $resultType
Write-Output ('RESULT:' + $verifyResult.ToString())
`

async function runWindowsHello(
  mode: 'check' | 'verify',
  reason = 'Lab notebook signature'
): Promise<string> {
  const scriptPath = join(tmpdir(), `lab-hello-${randomBytes(8).toString('hex')}.ps1`)
  try {
    writePs1Utf8Bom(scriptPath, PS_HELPER)
    const { stdout, stderr } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-Mode',
        mode,
        '-Reason',
        reason
      ],
      {
        windowsHide: true,
        timeout: 180_000,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024
      }
    )
    const err = String(stderr ?? '').trim()
    if (err && /ParserError|Exception|Error/i.test(err)) {
      throw new Error(err)
    }
    return String(stdout ?? '').trim()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // execFile は失敗時に stdout/stderr をメッセージに混ぜる。先頭だけ分かりやすくする
    const compact = msg
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => line && !line.startsWith('At ') && !line.startsWith('+'))
      .slice(0, 4)
      .join(' ')
    throw new Error(compact || msg)
  } finally {
    try {
      unlinkSync(scriptPath)
    } catch {
      /* ignore */
    }
  }
}

async function checkWindowsHelloAvailable(): Promise<boolean> {
  try {
    const out = await runWindowsHello('check')
    return out.includes('AVAIL:Available')
  } catch {
    return false
  }
}

async function verifyWindowsHello(reason: string): Promise<void> {
  // 理由文は -Reason 引数で渡す（スクリプト本体は ASCII のみ）
  const out = await runWindowsHello('verify', reason)
  const avail = out.match(/AVAIL:(\w+)/)?.[1]
  if (avail && avail !== 'Available') {
    throw new Error(mapHelloResult(avail))
  }
  const result = out.match(/RESULT:(\w+)/)?.[1]
  if (!result) {
    throw new Error('Windows Hello の応答を取得できませんでした。')
  }
  if (result !== 'Verified') {
    throw new Error(mapHelloResult(result))
  }
}

/** 端末の本人確認手段が使えるか */
export async function getDeviceAuthMethod(): Promise<DeviceAuthMethod> {
  if (process.platform === 'win32') {
    return (await checkWindowsHelloAvailable()) ? 'windows-hello' : 'unavailable'
  }
  if (process.platform === 'darwin') {
    try {
      return systemPreferences.canPromptTouchID() ? 'touch-id' : 'unavailable'
    } catch {
      return 'unavailable'
    }
  }
  return 'unavailable'
}

/**
 * 端末ロック解除相当の本人確認。
 * Windows: Hello（顔・指紋・PIN）／ macOS: Touch ID
 */
export async function verifyDeviceUser(reason: string): Promise<DeviceAuthMethod> {
  const method = await getDeviceAuthMethod()
  if (method === 'unavailable') {
    throw new Error(
      process.platform === 'win32'
        ? 'Windows Hello（顔・指紋・PIN）がこのアカウントで使えません。Windows の設定で有効にしてください。'
        : 'この端末では生体認証による本人確認を利用できません。'
    )
  }
  if (method === 'windows-hello') {
    await verifyWindowsHello(reason)
    return method
  }
  try {
    await systemPreferences.promptTouchID(reason)
  } catch {
    throw new Error('本人確認がキャンセルされました。')
  }
  return method
}
