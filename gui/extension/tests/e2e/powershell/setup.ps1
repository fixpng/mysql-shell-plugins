<#
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
#>

Set-Location $PSScriptRoot
$basePath = Join-Path $PSScriptRoot ".."
Set-Location $basePath
$basePath = Get-Location
$env:WORKSPACE = Resolve-Path(Join-Path $basePath ".." ".." ".." "..")

try {
    $err = 0

    $log = Join-Path $env:WORKSPACE "psSetupExt.log"

    function writeMsg($msg, $option){

        $msg | Out-File $log -Append

        Invoke-Expression "write-host `"$msg`" $option"
        
    }

    if (!$env:VSIX_PATH) {
        if (!$env:PB2_LINK){
            Throw "Please define 'PB2_LINK' env variable"
        }
    }
    
    if (!$env:VSCODE_VERSION){
        Throw "Please define 'VSCODE_VERSION' env variable"
    }

    $aux_proxy = $env:HTTP_PROXY
    $aux_http_proxy = $env:HTTPS_PROXY

    $env:HTTP_PROXY = ""
    $env:HTTPS_PROXY = ""

    function installChromedriver($vscodeVersion) {
        $job5 = Start-Job -Name "get-chromedriver-db" -ScriptBlock { 
            npm run e2e-tests-get-chromedriver -- -s $using:testResourcesDb -c $using:vscodeVersion
        }
        $job6 = Start-Job -Name "get-chromedriver-oci" -ScriptBlock { 
            npm run e2e-tests-get-chromedriver -- -s $using:testResourcesOci -c $using:vscodeVersion
        }
        $job7 = Start-Job -Name "get-chromedriver-shell" -ScriptBlock { 
            npm run e2e-tests-get-chromedriver -- -s $using:testResourcesShell -c $using:vscodeVersion
        }
        $job8 = Start-Job -Name "get-chromedriver-rest" -ScriptBlock { 
          npm run e2e-tests-get-chromedriver -- -s $using:testResourcesRest -c $using:vscodeVersion
        }

        # Wait for it all to complete
        While ( 
                ((Get-Job -Name "get-chromedriver-db").state -eq "Running") -or
                ((Get-Job -Name "get-chromedriver-oci").state -eq "Running") -or
                ((Get-Job -Name "get-chromedriver-shell").state -eq "Running") -or
                ((Get-Job -Name "get-chromedriver-rest").state -eq "Running")
            ){
            Receive-Job -Job $job5
            Receive-Job -Job $job6
            Receive-Job -Job $job7
            Receive-Job -Job $job8
        }
    }

    function installVsCode($vscodeVersion){

        $job1 = Start-Job -Name "get-vscode-db" -ScriptBlock { 
            npm run e2e-tests-get-vscode -- -s $using:testResourcesDb -c $using:vscodeVersion
        }
        $job2 = Start-Job -Name "get-vscode-oci" -ScriptBlock { 
            npm run e2e-tests-get-vscode -- -s $using:testResourcesOci -c $using:vscodeVersion
        }
        $job3 = Start-Job -Name "get-vscode-shell" -ScriptBlock { 
            npm run e2e-tests-get-vscode -- -s $using:testResourcesShell -c $using:vscodeVersion
        }
        $job4 = Start-Job -Name "get-vscode-rest" -ScriptBlock { 
            npm run e2e-tests-get-vscode -- -s $using:testResourcesRest -c $using:vscodeVersion
        }
        
        # Wait for it all to complete
        While ( 
                ((Get-Job -Name "get-vscode-db").state -eq "Running") -or
                ((Get-Job -Name "get-vscode-oci").state -eq "Running") -or
                ((Get-Job -Name "get-vscode-shell").state -eq "Running") -or
                ((Get-Job -Name "get-vscode-rest").state -eq "Running")
            ){
            Receive-Job -Job $job1
            Receive-Job -Job $job2
            Receive-Job -Job $job3
            Receive-Job -Job $job4
        }
    }

    function getVSCodeVersion ($path) {
        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $target = (Get-ChildItem -Path $path -Filter "*VSCode*").toString()
        if($isWindows) {
            $pinfo.FileName = "$target\bin\code.cmd"
        } else {
            $pinfo.FileName = "$target/bin/code"
        }
        
        $pinfo.RedirectStandardError = $true
        $pinfo.RedirectStandardOutput = $true
        $pinfo.UseShellExecute = $false
        $pinfo.Arguments = "--version"
        $p = New-Object System.Diagnostics.Process
        $p.StartInfo = $pinfo
        $p.Start() | Out-Null
        $p.WaitForExit()
        $stdout = $p.StandardOutput.ReadToEnd()
        $stderr = $p.StandardError.ReadToEnd()
        $info = $stdout -split "\n"
        return $info[0]
    }

    function removeExtensions () {
        $extDb = Join-Path $env:userprofile "test-resources-db" "ext"
        $extOci = Join-Path $env:userprofile "test-resources-oci" "ext"
        $extShell = Join-Path $env:userprofile "test-resources-shell" "ext"
        $extRest = Join-Path $env:userprofile "test-resources-rest" "ext"

        $job1 = Start-Job -Name "rm-ext-db" -ScriptBlock { 
            Remove-Item -Path $using:extDb -Force -Recurse
        }
        $job2 = Start-Job -Name "rm-ext-oci" -ScriptBlock { 
            Remove-Item -Path $using:extOci -Force -Recurse
        }
        $job3 = Start-Job -Name "rm-ext-shell" -ScriptBlock { 
            Remove-Item -Path $using:extShell -Force -Recurse
        }
        $job4 = Start-Job -Name "rm-ext-rest" -ScriptBlock { 
            Remove-Item -Path $using:extRest -Force -Recurse
        }
        
        # Wait for it all to complete
        While ( 
                ((Get-Job -Name "rm-ext-db").state -eq "Running") -or
                ((Get-Job -Name "rm-ext-oci").state -eq "Running") -or
                ((Get-Job -Name "rm-ext-shell").state -eq "Running") -or
                ((Get-Job -Name "rm-ext-rest").state -eq "Running")
            ){
            Receive-Job -Job $job1
            Receive-Job -Job $job2
            Receive-Job -Job $job3
            Receive-Job -Job $job4
        }
        
    }

    if ($isLinux) {
        $env:userprofile = $env:HOME
        $webCerts = Join-Path $env:userprofile ".mysqlsh-gui" "plugin_data" "gui_plugin" "web_certs"
        if (!(Test-Path -Path $webCerts)) {
            Throw "web_certs were not found. Please install VSCode and generate the web certificates manually"
        }
    } elseif($isWindows) {
        $webCerts = Join-Path $env:APPDATA "MySQL" "mysqlsh-gui" "plugin_data" "gui_plugin" "web_certs"
        if (!(Test-Path -Path $webCerts)) {
            Throw "web_certs were not found. Please install VSCode and generate the web certificates manually"
        }
    } else {
        Throw "MacOS is not supported"
    }

    if (Test-Path -Path $log){
        Remove-Item -Path $log -Recurse -Force	
    }

    New-Item -ItemType "file" -Path $log

    writeMsg "BRANCH: $env:EXTENSION_BRANCH"
    writeMsg "PUSH_ID: $env:EXTENSION_PUSH_ID"
    writeMsg "REVISION: $env:TARGET_REVID"
    writeMsg "WORKSPACE: $env:WORKSPACE"
    writeMsg "VSCODE_VERSION: $env:VSCODE_VERSION"
    writeMsg "VSIX_PATH: $env:VSIX_PATH"
    writeMsg "USER PROFILE: $env:USERPROFILE"
    writeMsg "BASE PATH: $basePath"

    # REMOVE INSTALLED EXTENSIONS
    writeMsg "Removing VSCode extensions..." "-NoNewLine"
    removeExtensions
    writeMsg "DONE"
    
    # REMOVE PACKAGE-LOCK.JSON
    if (Test-Path -Path "$basePath\package-lock.json"){
        writeMsg "Removing package-lock.json..." "-NoNewLine"
        Remove-Item -Path "$basePath\package-lock.json" -Force
        writeMsg "DONE"
    }
    
    #INSTALLING NODE MODULES
    writeMsg "Installing node modules..."
    $prc = Start-Process "npm" -ArgumentList "install" -Wait -PassThru -RedirectStandardOutput "$env:WORKSPACE\nodeExt.log" -RedirectStandardError "$env:WORKSPACE\nodeExtErr.log"
    if ($prc.ExitCode -ne 0){
        Throw "Error installing node modules"
    }
    else{
        writeMsg "DONE"
    }

    #CHECK TEST RESOURCES (we need 4 test-resources folder (vscode/chromedriver))
    $testResourcesDb = Join-Path $env:userprofile "test-resources-db"
    $testResourcesShell = Join-Path $env:userprofile "test-resources-shell"
    $testResourcesOci = Join-Path $env:userprofile "test-resources-oci"
    $testResourcesRest = Join-Path $env:userprofile "test-resources-rest"

    writeMsg "Checking config folders..." "-NoNewLine"
    $configs = @()
    $configs += Join-Path $env:userprofile "mysqlsh-db"
    $configs += Join-Path $env:userprofile "mysqlsh-oci"
    $configs += Join-Path $env:userprofile "mysqlsh-shell"
    $configs += Join-Path $env:userprofile "mysqlsh-rest"

    if($isWindows){
        $targetWebCerts = Join-Path $env:APPDATA "MySQL" "mysqlsh-gui" "plugin_data" "gui_plugin" "web_certs"
    } elseif($isLinux){
        $targetWebCerts = Join-Path $env:userprofile ".mysqlsh-gui" "plugin_data" "gui_plugin" "web_certs"
    }
    
    ForEach ($config in $configs) {
        if (!(Test-Path $config)) {
            New-Item -ItemType "directory" -Path $config
            writeMsg "Created $config"
            $mysqlsh = Join-Path $config "mysqlsh.log"  
            New-Item -ItemType "file" -Path $mysqlsh
            writeMsg "Created $mysqlsh"
            $guiPlugin = Join-Path $config "plugin_data" "gui_plugin"
            New-Item -ItemType "directory" -Path $guiPlugin
            writeMsg "Created $guiPlugin"
            writeMsg "Creating symlink for web certificates for $config ..." "-NoNewLine"
            $link = Join-Path $config "plugin_data" "gui_plugin" "web_certs"
            if ($isWindows){
                New-Item -ItemType Junction -Path $link -Target $targetWebCerts
            } else {
                New-Item -ItemType SymbolicLink -Path $link -Target $targetWebCerts
            }
            writeMsg "DONE"
        }
    } 
    writeMsg "DONE"

    if ($env:USE_PROXY) {
        writeMsg "Using PROXY $env:USE_PROXY"
        $env:HTTP_PROXY=$env:USE_PROXY
        $env:HTTPS_PROXY=$env:USE_PROXY
    }
    
    writeMsg "Checking if VSCode exists..." "-NoNewLine"

    if (!(Test-Path -Path $testResourcesDb)) {
        writeMsg "Not found. Start installing test-resources..." "-NoNewLine"
        installVsCode $env:VSCODE_VERSION
        writeMsg "DONE"
    } else {
        writeMsg "It does! Skipping installation."
        $version = getVSCodeVersion $testResourcesDb
        writeMsg "Checking VSCode version..." "-NoNewLine"

        if ($version -ne $env:VSCODE_VERSION) {
            writeMsg "'$version', requested version is '$env:VSCODE_VERSION'. Updating..." "-NoNewLine"
            installVsCode $env:VSCODE_VERSION
            writeMsg "DONE"
            $version = getVSCodeVersion $testResourcesDb
            if ($version -eq $env:VSCODE_VERSION) {
                writeMsg "DONE. VS Code is now on version $version"
            } else {
                writeMsg "ERROR. VS Code is still on version $version"
            }
        } else {
            writeMsg "$version. OK"
        } 
    }

    writeMsg "Checking if Chromedriver exists..." "-NoNewLine"
    $path = Join-Path $testResourcesDb "chromedriver"
    if (!(Test-Path -Path $path)) {
        writeMsg "Not found. Start installing Chromedriver..." "-NoNewLine"
        installChromedriver $env:VSCODE_VERSION
        writeMsg "DONE"
    } else {
        writeMsg "It does! Skipping installation."
    }

    # DOWNLOAD EXTENSION 
    if (!$env:VSIX_PATH) {
        writeMsg "Trying to download from PB2..."
        $bundles = (Invoke-WebRequest -NoProxy -Uri $env:PB2_LINK).content
        $bundles = $bundles | ConvertFrom-Json

        if ($isWindows) {
            $product = "mysql-shell-ui-plugin_binary_vs-code-extension_vsix--win32-x64"
            $artifact = "mysql-shell-for-vs-code-win32-x64"
        } elseif ($isLinux) {
            uname -m | Tee-Object -Variable cpuArch
            if ($cpuArch -eq "x86_64") {
                $product = "mysql-shell-ui-plugin_binary_vs-code-extension_vsix--linux-x64"
                $artifact = "mysql-shell-for-vs-code-linux-x64"
            } else {
                $product = "mysql-shell-ui-plugin_binary_vs-code-extension_vsix--linux-arm64"
                $artifact = "mysql-shell-for-vs-code-linux-arm64"
            }
        } else {
            Throw "Not supported platform"
        }
        
        $extension = ($bundles.builds | Where-Object {
            $_.product -eq $product
            }).artifacts | Where-Object {
                $_.name -like $artifact
            }

        if ($extension){
            $extension | ForEach-Object { 
                writeMsg "Downloading the extension ..." "-NoNewline" 
                $dest = Join-Path $env:WORKSPACE "$env:EXTENSION_BRANCH-$env:EXTENSION_PUSH_ID.vsix"
                Invoke-WebRequest -NoProxy -Uri $_.url -OutFile $dest
                writeMsg "DONE"
                }
            }
        else{
            writeMsg "Could not download the MySQL Shell for VS Code extension. You can download it manually and then set the VSIX_PATH env variable"
            exit 1
        }
    } else {
        $dest = $env:VSIX_PATH
    }

    # COPY OCI .PEM FILES
    $ociPath = Join-Path $env:userprofile ".oci"
    writeMsg "User profile path is: $ociPath"
    if ( !(Test-Path -Path $ociPath) ){
        writeMsg "Creating .oci folder..." "-NoNewLine"
        New-Item -Path $env:userprofile -Name ".oci" -ItemType "directory" -Force
        writeMsg "DONE"
    }

    $itemsPath = Join-Path $basePath "oci_files"
    Get-ChildItem -Path $itemsPath | % {
        writeMsg "Copying $_ file to .oci folder..." "-NoNewLine"
        Copy-Item -Path $_ $ociPath -Force
        writeMsg "DONE"
    }
    
    # INSTALL VSIX
    $extDBPath = Join-Path $testResourcesDb "ext"
    $extOCIPath = Join-Path $testResourcesOci "ext"
    $extShellPath = Join-Path $testResourcesShell "ext"
    $extRestPath = Join-Path $testResourcesRest "ext"

    writeMsg "Start installing the extension into vscode instances..." "-NoNewLine"
    $job1 = Start-Job -Name "install-vsix-db" -ScriptBlock { 
        npm run e2e-tests-install-vsix -- -s $using:testResourcesDb -e $using:extDBPath -f $using:dest
    }
    $job2 = Start-Job -Name "install-vsix-shell" -ScriptBlock { 
        npm run e2e-tests-install-vsix -- -s $using:testResourcesShell -e $using:extShellPath -f $using:dest
    }
    $job3 = Start-Job -Name "install-vsix-oci" -ScriptBlock { 
        npm run e2e-tests-install-vsix -- -s $using:testResourcesOci -e $using:extOCIPath -f $using:dest
    }
    $job4 = Start-Job -Name "install-vsix-rest" -ScriptBlock { 
        npm run e2e-tests-install-vsix -- -s $using:testResourcesRest -e $using:extRestPath -f $using:dest
    }

    # Wait for it all to complete
    While ( ((Get-Job -Name "install-vsix-db").state -eq "Running") -or
            ((Get-Job -Name "install-vsix-shell").state -eq "Running") -or
            ((Get-Job -Name "install-vsix-oci").state -eq "Running") -or
            ((Get-Job -Name "install-vsix-rest").state -eq "Running")
        ){
        Receive-Job -Job $job1
        Receive-Job -Job $job2
        Receive-Job -Job $job3
        Receive-Job -Job $job4
    }
    writeMsg "DONE installing the extension!"
    
    # TSC TO TEST FILES
    writeMsg "TSC..." "-NoNewLine"
    Start-Process -FilePath "npm" -ArgumentList "run", "e2e-tests-tsc" -Wait -PassThru -RedirectStandardOutput "$env:WORKSPACE\env.log" -RedirectStandardError "$env:WORKSPACE\envErr.log"
    writeMsg "DONE"

}
catch {
    writeMsg $_
	writeMsg $_.ScriptStackTrace
	$err = 1
}
finally {
    if ( $err -eq 1){
        exit 1
    }
}
