$project = 'C:\Users\Sebastian Myrdahl\Documents\gigapi\gigapi\gigapi'

Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq 'dotnet.exe' -and $_.CommandLine -match 'gigapi' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Start-Process dotnet -ArgumentList 'run' -WorkingDirectory $project
