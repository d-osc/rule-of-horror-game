$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$port = 8173
$listener = $null
while ($true) {
  try {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
    break
  } catch {
    $port++
    if ($port -gt 8180) {
      Write-Host "No free port found between 8173 and 8180. Close other servers and try again."
      exit 1
    }
  }
}
Write-Host ""
Write-Host "  Serving: $root"
Write-Host "  Playing: http://127.0.0.1:$port/"
Write-Host "  Keep this window open. Press Ctrl+C to stop the server."
Write-Host ""
Start-Process "http://127.0.0.1:$port/"
$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript'
  '.mjs'  = 'text/javascript'
  '.css'  = 'text/css'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.png'  = 'image/png'
  '.webp' = 'image/webp'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.glb'  = 'model/gltf-binary'
  '.mp3'  = 'audio/mpeg'
  '.wav'  = 'audio/wav'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.json' = 'application/json'
  '.map'  = 'application/json'
}
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path.EndsWith('/')) { $path += 'index.html' }
    $candidate = Join-Path $root ($path.Replace('/', '\').TrimStart('\'))
    $full = [IO.Path]::GetFullPath($candidate)
    $ok = $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path $full -PathType Leaf)
    if ($ok) {
      $bytes = [IO.File]::ReadAllBytes($full)
      $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
      if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.OutputStream.Close()
  }
} finally {
  $listener.Stop()
}
