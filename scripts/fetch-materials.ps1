$ErrorActionPreference = 'Stop'
$textureFolder = Join-Path $PSScriptRoot '..\public\textures'
New-Item -ItemType Directory -Force $textureFolder | Out-Null
$sources = @()
foreach ($assetName in @('interior_tiles', 'long_white_tiles', 'worn_plaster_wall')) {
  $metadata = Invoke-RestMethod ('https://api.polyhaven.com/files/' + $assetName)
  foreach ($roleName in @('Diffuse', 'nor_gl', 'Rough', 'AO')) {
    $fileUrl = $metadata.$roleName.'1k'.jpg.url
    $fileName = $assetName + '_' + $roleName.ToLower() + '.jpg'
    Invoke-WebRequest -Uri $fileUrl -OutFile (Join-Path $textureFolder $fileName)
    $sources += [pscustomobject]@{asset=$assetName;role=$roleName;file=$fileName;source=$fileUrl;license='CC0';page=('https://polyhaven.com/a/'+$assetName)}
    Write-Output $fileName
  }
}
$sources | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $textureFolder 'sources.json') -Encoding utf8

