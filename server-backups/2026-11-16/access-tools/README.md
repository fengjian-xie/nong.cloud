# 只读服务器导出 helper（尚未授权或部署）

## 临时访问授权安装器

`grant_readonly_access.py` 是供服务器所有者审查后在 root Workbench 终端亲自运行的授权安装器。它接收一个专用 **Ed25519 公钥** 参数，在 `/root` 下新建仅 root 可访问的 helper 目录，并向现有 `authorized_keys` 追加一条有效两小时的受限授权。它保留原有授权、inode、所有权和权限，不重启服务或修改 SSH 全局配置。

该授权通过 `restrict` 关闭 PTY/转发，并通过固定强制命令仅允许下面的 `inventory` 与 `export` 协议。到期时间按 OpenSSH 8.0 所需的服务器本地时区生成；固定截止时间也传入 helper，在遍历和读取期间检查。安装器内嵌的压缩 helper 会先验证 SHA-256，再安装为 root 专属文件。公钥不是私钥；本机私钥不应上传到服务器或仓库。

发布这些工具不代表已获得服务器访问、执行授权或完成全部代码备份。只有服务器所有者运行安装器并看到 `NONG_READONLY_BACKUP_READY` 后，新的受限连接才生效。两小时后该公钥不能用于新的认证，helper 也拒绝继续读取；到期授权行和仅含工具源码的目录仍留在服务器，后续可按其独有任务注释清理。

`readonly_backup_helper.py` 仅使用 Python 3 标准库，供 SSH `forced-command` 调用。本地准备不代表服务器已授权、已备份或已经取得私有源码。脚本不生成密钥，不修改服务器文件，不连接网络，不推送 GitHub。

固定 forced-command 必须由授权方设置 `NONG_BACKUP_DEADLINE`（服务器 Unix 时间，最长两小时），并用隔离模式运行，例如 `/usr/bin/env NONG_BACKUP_DEADLINE=<固定到期时间> /usr/bin/python3 -I -B -S <固定helper路径>`。脚本拒绝缺失、非有限值、已过期或超过两小时的到期时间，每次遍历和文件读取重新检查，并将单次命令限制为十分钟。不要把到期时间或 helper 路径取自远程原始命令。

## 唯一允许的 SSH 原始命令

```text
inventory
export ["/var/www/nong.cloud","/明确出现在inventory中的项目根目录"]
```

`inventory` 将 JSON 写到 stdout；在 `/var/www /root /home /opt /srv /data /www` 扫描最多六层源码标记，并登记已知 nong 站点目录。它仅使用固定参数 `ss` 和 `/proc/<PID>/cwd` 补充 8080 进程 PID/工作目录，不读取进程参数或环境。8080 的真实工作目录即使没有源码标记，也仅在搜索锚点之下、不是整段用户 home、路径不含敏感目录且逐段无 symlink 时成为 `port_8080_cwd` 候选，可备份仅留 JAR 的运行目录。整个搜索锚点（例如 `/root`）及 `/home/<user>` 不会成为可导出项目根目录。

`export` 必须提供 1–32 个不重复的、精确匹配当前重新计算 inventory 候选的绝对根目录。stdout 只有流式 tar.gz，错误写 stderr。命令不接受 shell、单文件路径、任意系统目录、额外参数或授权列表之外的根目录。

导出归档包含：

- `source/<根目录ID>/...`：源码与公开发布文件，仍须本地审查后才能公开。
- `private-review/<根目录ID>/...`：生产配置、PHP 及可能内含配置的文件，权限强制为 0600；原始文件必须保留在本地私有目录，不能原样上传公开仓库。完成审查、脱敏的副本可另行提交。
- `SERVER-BACKUP-MANIFEST.json`：根目录对应关系、每文件 SHA-256、遗漏及排除原因、读取时是否发生变化。

文件按名称排除 `.ssh/.aws/.aliyun/.alibabacloud/.config`、环境配置 `.env*`、密钥、凭据、cookie、真实上传/附件、数据库、日志、依赖缓存与已有压缩包。数据库迁移 SQL 保留，其他未审 SQL 排除。全部 symlink、硬链接和特殊文件均排除。每个目录与文件通过 `dir_fd + O_NOFOLLOW` 打开；不跟随路径祖先或末级 symlink。导出有 100000 文件、5 GiB 解压体积及 64 层目录限制，不能因此称为完整服务器镜像。

归档整体属于**本地私有待审材料**。请在本机用私有目录和 `umask 077` 保存，不把整个导出目录或生产配置直接交给公开 GitHub 提交流程。脚本不读取 `.env`、密钥或被排除文件来做内容审查；名称安全的业务源码也可能内嵌凭据，仍需后续审查。文件枚举后的实际 `fstat` 大小与流式读取字节会再次累计检查，不能通过文件增长绕过体积上限；任何非零退出的归档都必须丢弃。

## 本地 fixture 验证

```bash
python3 -B -m unittest -v test_readonly_backup_helper.py
```

测试使用临时目录，不访问服务器。15个 fixture 覆盖正常导出与 SHA、敏感文件从未打开、生产配置/PHP 私有分区、目录越界和路径穿越、外部/内部 symlink、硬链接、任意命令拒绝、扫描深度限制、到期时间缺失/无效/过期拒绝、遍历/流读取期间重新检查时限、无源码标记的8080工作目录、用户 home 与敏感工作目录拒绝，以及枚举后文件增长和实际读取体积上限。
