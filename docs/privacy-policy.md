# プライバシーポリシー / Privacy policy

最終更新日 / Last updated: 2026-11-18（対象: LabNoteChain 0.1.0）

## 日本語

### 要点

**LabNoteChain は、利用者が明示的に指定した場所以外へ、情報を送信しません。** 開発者や第三者のサーバーへ、ノートの内容・利用状況・不具合情報などを送ることはありません。

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

### 保存される情報

次の情報は、すべて利用者の PC 上にのみ保存されます。

- ノート、ページ、添付ファイル、ライブラリのフォルダ構成（既定ではユーザーデータ領域、設定で変更可）
- アプリの設定（言語、テーマ、研究室共有のパスなど）
- 署名者として登録した名前と署名鍵（署名機能を使った場合のみ）

開発者はこれらの情報にアクセスできません。

### 通信について

- 本アプリは、**ネットワークへ自分から接続しません。** 利用状況の収集（テレメトリ）、解析、広告、クラッシュレポート、自動アップデートの機能は含まれていません。
- 本アプリが行う書き込みは、利用者が指定したフォルダへのファイル出力だけです。次のものが該当します。
  - 研究室共有（設定 → 接続）で指定した、共有 PC・NAS・同期フォルダへのタイムスタンプ記録の出力
  - バックアップ・証跡パッケージの書き出し先として、利用者が選んだ場所
- 指定したフォルダが OneDrive、Google Drive、MEGA、Dropbox などの同期フォルダである場合、その同期アプリが内容をクラウドへ送ることがあります。この送信は各サービスの規約・プライバシーポリシーに従います。本アプリはそれらを制御しません。
- 本アプリのダウンロードは GitHub から行います。ダウンロード時の取り扱いは GitHub のプライバシーポリシーに従います。

### 生体認証について

署名機能では、Windows Hello（顔・指紋・PIN）による本人確認を使います。確認は Windows が行い、本アプリは生体情報を受け取りません。

### バックアップファイルの取り扱い

バックアップや証跡パッケージは、暗号化されていない JSON ファイルです。ノートの内容が含まれるため、保管場所と共有先は利用者が管理してください。

### 第三者のソフトウェア

本アプリは Electron などのオープンソースソフトウェアを利用しています。ライセンスの一覧は、インストールされたアプリのフォルダと、ソースコードのリポジトリに含まれます。

### 変更とお問い合わせ

方針を変更する場合は、このページを更新し、更新日を改めます。ご質問は [GitHub Issues](https://github.com/yoshifordev-cyber/LabNoteChain/issues) へお寄せください。

## English

### Summary

**LabNoteChain does not send information anywhere except to locations that you explicitly specify.** It does not send your notes, usage data, or crash information to the developer or to any third party.

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

### What is stored

The following data is stored only on your own computer.

- Notebooks, pages, attachments, and the library folder layout (in the user data folder by default; you can change the location in the settings)
- App settings (language, theme, the lab share path, and so on)
- The signer name and signing key, only if you use the signing feature

The developer has no access to this data.

### Network access

- The app **does not open network connections on its own.** It has no telemetry, analytics, advertising, crash reporting, or auto-update feature.
- The only writes the app performs are file outputs to folders that you choose:
  - Timestamp records written to the shared PC, NAS, or synced folder that you set under Settings → Connections (lab share)
  - The destination you pick when you export a backup or an evidence package
- If a folder you choose is synchronized by OneDrive, Google Drive, MEGA, Dropbox, or a similar service, that sync client may upload its contents to the cloud. That transfer follows the terms and privacy policy of that service. This app does not control it.
- You download the app from GitHub. GitHub's privacy policy applies to the download.

### Biometrics

The signing feature uses Windows Hello (face, fingerprint, or PIN) to confirm the user. Windows performs the check. The app never receives biometric data.

### Backup files

Backup files and evidence packages are plain, unencrypted JSON files and contain the contents of your notes. You are responsible for where you store and share them.

### Third-party software

The app uses open-source software such as Electron. A list of licenses is included in the installed application folder and in the source repository.

### Changes and contact

If this policy changes, this page is updated and the date above is revised. Please send questions to [GitHub Issues](https://github.com/yoshifordev-cyber/LabNoteChain/issues).
