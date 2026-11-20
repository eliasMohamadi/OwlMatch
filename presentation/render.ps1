# Renders every slide of OwlMatch-Pitch.pptx to PNG through PowerPoint (visual QA).
param([string]$Out = "$PSScriptRoot\renders")
Remove-Item -Recurse -Force $Out -ErrorAction SilentlyContinue
New-Item -ItemType Directory $Out | Out-Null
$app = New-Object -ComObject PowerPoint.Application
$deck = $app.Presentations.Open("$PSScriptRoot\OwlMatch-Pitch.pptx", $true, $false, $false)
foreach ($slide in $deck.Slides) { $slide.Export("$Out\slide-$($slide.SlideIndex).png", 'PNG', 1600, 900) }
$deck.Close(); $app.Quit()
