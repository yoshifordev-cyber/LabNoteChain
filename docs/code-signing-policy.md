# Code signing policy / コード署名ポリシー

最終更新日 / Last updated: 2026-11-18

## Status / 現在の状況

- **LabNoteChain v0.1.0 is not code-signed.** The installer is built from this repository and published with a SHA-256 checksum on the [Releases](https://github.com/yoshifordev-cyber/LabNoteChain/releases) page. Windows SmartScreen may warn about an unknown publisher.
- **v0.1.0 にはコード署名がありません。** インストーラーはこのリポジトリのソースからビルドし、[Releases](https://github.com/yoshifordev-cyber/LabNoteChain/releases) に SHA-256 チェックサムとともに公開しています。Windows SmartScreen が「発行元が不明」と警告することがあります。
- We plan to apply to the SignPath Foundation for free code signing for open-source projects. **The statement below applies only to releases that actually carry a SignPath Foundation signature.** It does not apply to v0.1.0.
- コード署名は、オープンソースプロジェクト向けに SignPath Foundation の無償枠へ申請する予定です。**以下の表記は、実際に SignPath Foundation の署名が付いたリリースにだけ適用されます。** v0.1.0 には適用されません。

## Attribution / 署名の提供元

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

## Team roles / チームの役割

LabNoteChain is currently maintained by a single person. The roles below are all held by the same maintainer.

現在、LabNoteChain は 1 人でメンテナンスしています。以下の役割はすべて同じメンテナーが担います。

| Role / 役割 | Responsibility / 責任 | Member / メンバー |
|---|---|---|
| Authors / Committers | Modify the source code in the repository / リポジトリのソースコードを変更する | [yoshifordev-cyber](https://github.com/yoshifordev-cyber) |
| Reviewers | Review changes proposed by people who are not committers (pull requests) / コミッター以外からの変更提案（プルリクエスト）をレビューする | [yoshifordev-cyber](https://github.com/yoshifordev-cyber) |
| Approvers | Approve each signing request, release by release / 署名リクエストをリリースごとに承認する | [yoshifordev-cyber](https://github.com/yoshifordev-cyber) |

If more maintainers join, the roles are split and this page is updated. メンテナーが増えた場合は、役割を分けてこのページを更新します。

## What is signed / 署名の対象

- Only the Windows installer and application executables **built from this repository's source code** are signed. / このリポジトリのソースコードから**ビルドした** Windows インストーラーと実行ファイルだけを署名します。
- Third-party binaries that are included unmodified (for example Electron) are not signed with this project's certificate. / 変更せずに同梱するサードパーティのバイナリ（Electron など）は、このプロジェクトの証明書では署名しません。
- Product name is `LabNoteChain`, and the product version is the same in every file of a release. / 製品名は `LabNoteChain` とし、製品バージョンはリリース内のすべてのファイルで同じ値にします。

## How a release is signed / 署名の手順

1. The release is built from a tagged commit of this repository. / リリースは、このリポジトリのタグ付きコミットからビルドします。
2. The build artifact is submitted for signing. / ビルド成果物を署名にかけます。
3. The approver manually approves each signing request. Nothing is signed automatically. / 承認者が署名リクエストを毎回手動で承認します。自動で署名されることはありません。
4. The signed installer and a `SHA256SUMS.txt` file are published on the Releases page. / 署名済みのインストーラーと `SHA256SUMS.txt` を Releases に公開します。

## Security of the maintainer account / アカウントの保護

The maintainer uses multi-factor authentication for GitHub and for SignPath. / メンテナーは GitHub と SignPath の両方で多要素認証を使います。

## Privacy policy / プライバシーポリシー

See the [privacy policy](privacy-policy.md).

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

## How to check a release / リリースの確認方法

- Compare the installer's SHA-256 with `SHA256SUMS.txt`: / インストーラーの SHA-256 を `SHA256SUMS.txt` と照合します。

  ```powershell
  Get-FileHash .\LabNoteChain-Setup-<version>.exe -Algorithm SHA256
  ```

- For a signed release, open the file's Properties → Digital Signatures tab. The signer is shown as SignPath Foundation. / 署名済みリリースでは、ファイルのプロパティ → デジタル署名タブで、署名者が SignPath Foundation と表示されます。

## Reporting a problem / 問題の報告

If you think a signed file violates the SignPath Foundation conditions, report it to [support@signpath.io](mailto:support@signpath.io) and to this project's [Issues](https://github.com/yoshifordev-cyber/LabNoteChain/issues). 署名済みファイルが SignPath Foundation の条件に反していると思われる場合は、support@signpath.io と、このプロジェクトの Issues へ連絡してください。
