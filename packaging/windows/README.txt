Vatrix（混映）· Windows 免安装版
==================================

解压后双击 Vatrix.exe 即可使用，不需要安装，也不写注册表。
整个文件夹可以放在任何位置（包括 U 盘）；ffmpeg.exe 和 ffprobe.exe 必须和 Vatrix.exe 放在同一个文件夹里。

系统要求
- Windows 10 / 11（64 位）。
- 需要 Microsoft Edge WebView2 运行时。Windows 11 自带；Windows 10 一般随 Edge 更新已装好。
  如果双击后没有窗口，请从 https://developer.microsoft.com/microsoft-edge/webview2/ 安装 Evergreen 运行时。

第一次运行
- 这个程序没有代码签名，Windows SmartScreen 可能提示「Windows 已保护你的电脑」：
  点「更多信息」→「仍要运行」即可。

使用
1. 把视频拖进窗口（或点「选择视频」）。
2. 右侧「编码参数」一般保持默认；seed 是你的密钥，观众端要一致（勾了「把 seed 也写进二维码」就不用告诉观众）。
3. 点「加密打乱」，输出文件默认放在视频旁边。把它上传到 B 站或 YouTube。
4. 观众安装油猴脚本 vatrix.user.js（在同一个 Release 页面下载），打开视频就会自动还原。
   拿到加密后的文件，也可以拖回本程序点「解密还原」。

设置保存在本机的 WebView 数据里，删除程序文件夹不会影响别的软件。

关于 ffmpeg
- 随附的 ffmpeg.exe / ffprobe.exe 是 gyan.dev 的 essentials 构建（GPL v3），
  许可证、构建说明和源代码地址见 licenses 文件夹。Vatrix 以独立进程调用它们。

项目主页：https://github.com/WJZ-P/Vatrix
