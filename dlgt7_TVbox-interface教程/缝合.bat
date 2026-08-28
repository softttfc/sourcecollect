@echo off
:: 设置当前目录变量
set "CURRENT_DIR=%~dp0"

:: 1. 清理旧的输出文件
del "%CURRENT_DIR%\custom_spider.jar"

:: 2. 反编译主程序的 DEX (使用 baksmali)
echo Decompiling Main Classes...
java -jar "%CURRENT_DIR%\3rd\baksmali-2.5.2.jar" d "%CURRENT_DIR%\..\app\build\intermediates\dex\release\minifyReleaseWithR8\classes.dex" -o "%CURRENT_DIR%\Smali_classes"

:: 注意：原脚本中运行 XBPQ.jar 的那行已删除，因为 XBPQ 的 smali 文件应由你在第8步手动准备好

:: 3. 清理 spider.jar 的工作目录
rd /s/q "%CURRENT_DIR%\spider.jar\smali\com\github\catvod\spider"
rd /s/q "%CURRENT_DIR%\spider.jar\smali\com\github\catvod\parser"
rd /s/q "%CURRENT_DIR%\spider.jar\smali\com\github\catvod\js"

:: 4. 创建目录结构
if not exist "%CURRENT_DIR%\spider.jar\smali\com\github\catvod\" md "%CURRENT_DIR%\spider.jar\smali\com\github\catvod\"

:: 5. 移动主程序的 smali 文件到工作目录
move "%CURRENT_DIR%\Smali_classes\com\github\catvod\spider" "%CURRENT_DIR%\spider.jar\smali\com\github\catvod\"
move "%CURRENT_DIR%\Smali_classes\com\github\catvod\parser" "%CURRENT_DIR%\spider.jar\smali\com\github\catvod\"
move "%CURRENT_DIR%\Smali_classes\com\github\catvod\js" "%CURRENT_DIR%\spider.jar\smali\com\github\catvod\"

:: ==========================================
:: 6. 缝合 XBPQ (这里是新增的核心逻辑)
:: ==========================================
echo Injecting XBPQ...

:: 复制 spider 目录 (使用 /y 默认覆盖，/e 包含子目录和空目录)
xcopy /s /y "%CURRENT_DIR%\3rd\xbpq\spider\*" "%CURRENT_DIR%\spider.jar\smali\com\github\catvod\spider\"

:: 检查 parser 目录是否存在，不存在则创建
if not exist "%CURRENT_DIR%\spider.jar\smali\com\github\catvod\parser\" md "%CURRENT_DIR%\spider.jar\smali\com\github\catvod\parser\"

:: 复制 parser 目录
xcopy /s /y "%CURRENT_DIR%\3rd\xbpq\parser\*" "%CURRENT_DIR%\spider.jar\smali\com\github\catvod\parser\"
:: ==========================================


:: 7. 回编译打包 (Apktool)
echo Rebuilding Jar...
java -jar "%CURRENT_DIR%\3rd\apktool_2.4.1.jar" b "%CURRENT_DIR%\spider.jar" -c

:: 8. 移动并重命名生成的 jar
move "%CURRENT_DIR%\spider.jar\dist\dex.jar" "%CURRENT_DIR%\custom_spider.jar"

:: 9. 生成 MD5 校验码
certUtil -hashfile "%CURRENT_DIR%\custom_spider.jar" MD5 | find /i /v "md5" | find /i /v "certutil" > "%CURRENT_DIR%\custom_spider.jar.md5"

:: 10. 清理临时文件
rd /s/q "%CURRENT_DIR%\spider.jar\build"
rd /s/q "%CURRENT_DIR%\spider.jar\smali"
rd /s/q "%CURRENT_DIR%\spider.jar\dist"
rd /s/q "%CURRENT_DIR%\Smali_classes"

echo Done.
pause