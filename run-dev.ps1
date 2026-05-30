# run-dev.ps1
# Load test environment variables before running dev server
Get-Content .env.test | ForEach-Object {
    if ($_ -match "^([^#\s][^=]*)=(.*)$") {
        $name = $Matches[1].Trim()
        $value = $Matches[2].Trim()
        # Remove single/double quotes around the value
        $value = $value -replace "^['""]|['""]$", ""
        [System.Environment]::SetEnvironmentVariable($name, $value, [System.EnvironmentVariableTarget]::Process)
        Write-Host "Set process environment variable: $name"
    }
}
npm run dev
