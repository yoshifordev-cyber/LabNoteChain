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
