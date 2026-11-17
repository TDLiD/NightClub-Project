<#
add_rocketbox.ps1 — Microsoft Rocketbox 캐릭터를 MettaBus 프로젝트에 추가 (Windows PowerShell용, add_model.sh 와 같은 처리)

사용 예:
  powershell -ExecutionPolicy Bypass -File tools\realhuman\add_rocketbox.ps1
  powershell -ExecutionPolicy Bypass -File tools\realhuman\add_rocketbox.ps1 -Avatars Security_Male_01
  powershell -ExecutionPolicy Bypass -File tools\realhuman\add_rocketbox.ps1 -WhatIf      # 실제 변환 없이 계획만 표시

처리 순서(캐릭터마다):
  1. Rocketbox 저장소에서 해당 폴더만 내려받기(git sparse-checkout add)
  2. 이미 manifest.json 에 있는 캐릭터(src 같음)는 건너뜀
  3. 다음 번호 자동 부여(f_21, m_26 …)
  4. rb_conv.py(표정 67종 정리·WebP) → rb_lod.py(LOD)  ※ rh_convert 는 Rocketbox 에 쓰지 않음(cm 스케일 유지)
  5. gltf-transform 압축 → <id>.glb / _lod.glb / _lodm.glb
  6. rb_portrait.py 로 프로필·전신 사진, mini 썸네일
  7. manifest_add.js 로 등록 + src 에 Rocketbox 원본 이름 기록

필요: git, Python 3.13 + 'py -3.13 -m pip install bpy pillow'(bpy 5.x 는 3.13 전용), Node.js, npm i -g @gltf-transform/cli
  -Python 을 지정하지 않으면 py -3.13 → py -3.11 → python 순서로 bpy 가 설치된 것을 찾아 씀
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Project = 'C:\Users\user\Desktop\Cursor\Gemini\Result\MettaBus_1',
    [string]$Repo    = 'C:\Users\user\Desktop\Cursor\Gemini\Result\MettaBus_test\Microsoft-Rocketbox',
    [string[]]$Avatars = @('Security_Female_01', 'Security_Male_01', 'Sports_Female_02', 'Sports_Male_04'),
    [string]$Python = 'auto',     # 'auto' 또는 python.exe 경로 / 'py -3.13'
    [string]$Drop = 'pistol',     # 제거할 부위(쉼표 구분). 빈 값이면 아무것도 지우지 않음
    [switch]$Redo                 # 이미 등록된 캐릭터도 같은 id 로 다시 변환
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:PYTHONIOENCODING = 'utf-8'
$env:RB_DROP = $Drop

# ── 캐릭터별 설정: 성별 · 스타일 이름 · 외모(east|west) · 옷(dressy|casual|suit) · 폴더 ──
# 수영복(Sports_Female_01, Sports_Male_01)·축구 유니폼(Sports_Male_02/03)은 클럽에 맞지 않아 기본 목록에서 뺐습니다.
$Catalog = @{
    'Security_Female_01' = @{ g = 'f'; label = '블랙 경호원 유니폼';   look = 'west'; wear = 'suit';   dir = 'Professions' }
    'Security_Male_01'   = @{ g = 'm'; label = '그레이 경호원 유니폼'; look = 'west'; wear = 'suit';   dir = 'Professions' }
    'Sports_Female_02'   = @{ g = 'f'; label = '그레이 탱크톱 & 팬츠'; look = 'west'; wear = 'casual'; dir = 'Professions' }
    'Sports_Male_04'     = @{ g = 'm'; label = '블루 탱크톱 & 반바지'; look = 'west'; wear = 'casual'; dir = 'Professions' }
    'Sports_Female_01'   = @{ g = 'f'; label = '핑크 비키니';          look = 'west'; wear = 'dressy'; dir = 'Professions' }
    'Sports_Male_01'     = @{ g = 'm'; label = '수영 반바지';          look = 'west'; wear = 'casual'; dir = 'Professions' }
    'Sports_Male_02'     = @{ g = 'm'; label = '축구 유니폼';          look = 'west'; wear = 'casual'; dir = 'Professions' }
    'Sports_Male_03'     = @{ g = 'm'; label = '축구 유니폼 (곱슬머리)'; look = 'west'; wear = 'casual'; dir = 'Professions' }
}

$Tools = Join-Path $Project 'tools\realhuman'
$H     = Join-Path $Project 'public\models\humans'
$Prof  = Join-Path $Project 'public\profile\real'
$Man   = Join-Path $H 'manifest.json'

function Run([string]$exe, [string[]]$argv) {
    Write-Host "  > $exe $($argv -join ' ')" -ForegroundColor DarkGray
    & $exe @argv
    if ($LASTEXITCODE -ne 0) { throw "실패 (종료 코드 $LASTEXITCODE): $exe $($argv -join ' ')" }
}

# ── 0. 사전 점검 ──
Write-Host '== 사전 점검' -ForegroundColor Cyan
foreach ($p in @($Project, $Repo, $Tools, $Man)) { if (-not (Test-Path $p)) { throw "경로 없음: $p" } }
foreach ($c in @('git', 'node', 'gltf-transform')) {
    if (-not (Get-Command $c -ErrorAction SilentlyContinue)) { throw "명령 없음: $c  (설치 후 다시 실행)" }
}
function Resolve-Py([string]$p) {
    $eap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try {
        $cands = if ($p -eq 'auto') { @('py -3.13', 'py -3.11', 'python') } else { @($p) }
        foreach ($c in $cands) {
            $parts = @($c -split ' ' | Where-Object { $_ })
            if (-not (Get-Command $parts[0] -ErrorAction SilentlyContinue)) { continue }
            $pre = @(); if ($parts.Count -gt 1) { $pre = $parts[1..($parts.Count - 1)] }
            $exe = & $parts[0] @pre -c "import sys; print(sys.executable)" 2>$null
            if ($LASTEXITCODE -ne 0 -or -not $exe) { continue }
            $exe = "$exe".Trim()
            $ver = & $exe -c "import bpy, PIL; print(bpy.app.version_string)" 2>$null
            if ($LASTEXITCODE -eq 0) { Write-Host "  Python: $exe  (bpy $ver)"; return $exe }
            Write-Host "  $c ($exe): bpy/pillow 없음" -ForegroundColor DarkGray
        }
        return $null
    } finally { $ErrorActionPreference = $eap }
}
$Python = Resolve-Py $Python
if (-not $Python) {
    throw @"
bpy 가 설치된 Python 을 찾지 못했습니다. bpy(Blender 모듈)는 Python 3.13 전용입니다.
  1) winget install -e --id Python.Python.3.13
  2) py -3.13 -m pip install bpy pillow
  3) 이 스크립트를 다시 실행
"@
}

# 이미 들어간 원본 이름, 다음 번호
$M = Get-Content $Man -Raw -Encoding UTF8 | ConvertFrom-Json
$used = @($M.models | ForEach-Object { $_.src })
function NextId([string]$g) {
    $nums = @($M.models | Where-Object { $_.id -match "^${g}_(\d+)$" } | ForEach-Object { [int]($_.id.Split('_')[1]) })
    $n = [int](($nums + 0) | Measure-Object -Maximum).Maximum + 1
    return ('{0}_{1:D2}' -f $g, $n)
}

$done = @()
foreach ($name in $Avatars) {
    Write-Host "`n== $name" -ForegroundColor Cyan
    if (-not $Catalog.ContainsKey($name)) { Write-Warning "설정표(`$Catalog)에 없는 캐릭터입니다. 스크립트 위쪽 표에 추가하세요. 건너뜀"; continue }
    $c = $Catalog[$name]
    $prev = @($M.models | Where-Object { $_.src -eq $name })
    if ($prev.Count) {
        if (-not $Redo) { Write-Host "  이미 manifest.json 에 있음($($prev[0].id)) → 건너뜀 (다시 만들려면 -Redo)" -ForegroundColor Yellow; continue }
        $id = $prev[0].id; Write-Host "  -Redo: $id 를 다시 만듭니다" -ForegroundColor Yellow
    } else { $id = NextId $c.g }
    $rel = "Assets/Avatars/$($c.dir)/$name"
    $src = Join-Path $Repo ($rel -replace '/', '\')
    Write-Host "  id=$id  label=$($c.label)  look=$($c.look)  wear=$($c.wear)"
    if (-not $PSCmdlet.ShouldProcess("$name → $id", '변환·등록')) { $M.models += [pscustomobject]@{ id = $id; src = $name }; continue }

    # 1. 내려받기
    if (-not (Test-Path (Join-Path $src 'Export'))) { Run 'git' @('-C', $Repo, 'sparse-checkout', 'add', $rel) }
    if (-not (Test-Path (Join-Path $src 'Export'))) { throw "내려받기 실패: $src" }

    $T = Join-Path $env:TEMP ("rbadd_" + [guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Path $T | Out-Null
    $env:RB_WORK = $T
    try {
        # 2. 변환
        Run $Python @((Join-Path $Tools 'rb_conv.py'), $src, "$T\raw.glb")
        # Rocketbox 는 rh_convert 를 거치지 않음(v46 원본 45명과 같은 cm 스케일 유지 — 키는 게임이 뼈 높이로 맞춤)
        Copy-Item "$T\raw.glb" "$T\$id.glb"
        Run $Python @((Join-Path $Tools 'rb_lod.py'), "$T\$id.glb", "$T\${id}_lod.glb")
        # 3. 압축 → 프로젝트
        Run 'gltf-transform' @('meshopt', "$T\$id.glb", "$H\$id.glb")
        Run 'gltf-transform' @('meshopt', "$T\${id}_lod.glb", "$H\${id}_lod.glb")
        Run 'gltf-transform' @('resize', "$H\${id}_lod.glb", "$T\m.glb", '--width', '256', '--height', '256')
        Run 'gltf-transform' @('meshopt', "$T\m.glb", "$H\${id}_lodm.glb")
        # 4. 프로필·전신 사진
        New-Item -ItemType Directory -Force -Path "$H\full", "$Prof\mini" | Out-Null
        Run $Python @((Join-Path $Tools 'rb_portrait.py'), "$T\$id.glb", "$Prof\$id.jpg")
        Run $Python @((Join-Path $Tools 'rb_portrait.py'), "$T\$id.glb", "$H\full\$id.jpg", '-', '-', 'full')
        Run $Python @('-c', "from PIL import Image; Image.open(r'$Prof\$id.jpg').resize((128,160)).save(r'$Prof\mini\$id.jpg', quality=84)")
        # 5. manifest 등록 + 원본 이름 기록
        Run 'node' @((Join-Path $Tools 'manifest_add.js'), $id, $c.g, $c.label, $c.look, $c.wear)
        $js = "const fs=require('fs');const P=process.argv[1];const M=JSON.parse(fs.readFileSync(P,'utf8'));const e=M.models.find(m=>m.id===process.argv[2]);e.src=process.argv[3];fs.writeFileSync(P,JSON.stringify(M,null,1));"
        Run 'node' @('-e', $js, $Man, $id, $name)
        $M.models += [pscustomobject]@{ id = $id; src = $name }
        $done += "$id ← $name ($($c.label))"
        $sz = '{0:N0} / {1:N0} / {2:N0} KB' -f ((Get-Item "$H\$id.glb").Length / 1KB), ((Get-Item "$H\${id}_lod.glb").Length / 1KB), ((Get-Item "$H\${id}_lodm.glb").Length / 1KB)
        Write-Host "  완료: $id  (원본/LOD/LODm = $sz)" -ForegroundColor Green
    }
    finally { Remove-Item -Recurse -Force $T -ErrorAction SilentlyContinue }
}

Write-Host "`n== 결과" -ForegroundColor Cyan
if ($done.Count) { $done | ForEach-Object { Write-Host "  $_" } } else { Write-Host '  추가된 캐릭터 없음' }
Write-Host @"

다음 할 일
  1) npm start 후 브라우저에서 키·방향·표정·LOD 전환 확인 (끄기: 주소 뒤 ?noreal)
  2) 경호원·웨이터로 쓰려면 manifest.json 의 staff, 특정 NPC 에 쓰려면 assign 에 id 지정
  3) 결과가 이상하면 해당 id 의 파일 3개·사진 2개와 manifest 항목을 지우고 다시 실행
"@
