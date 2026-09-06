#Requires -Version 5.1
<#
.NOTES
  Deploys the Nova escalation fan-out stack (Part 2) to AWS.

  Steps:
    1. Built any app changes and packages the Lambda (node scripts/package.js)
    2. Uploads lambda/function.zip to an S3 artifact bucket
    3. Deploys aws/infrastructure/template.yaml via aws cloudformation deploy
    4. Prints the stack outputs (queue URL, alarm name, ...)

  Config (PowerShell):  $Env:AWS_ARTIFACT_BUCKET, $Env:AWS_STACK_NAME, $Env:NOVA_ALARM_EMAIL, $Env:NOVA_API_CALLBACK_URL
#>
param(
  [string]$Profile = $env:AWS_PROFILE,
  [string]$Region = $env:AWS_REGION,
  [string]$ArtifactBucket = $env:AWS_ARTIFACT_BUCKET,
  [string]$StackName = $env:AWS_STACK_NAME,
  [string]$AlarmEmail = $env:NOVA_ALARM_EMAIL,
  [string]$ApiCallbackUrl = $env:NOVA_API_CALLBACK_URL
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot   # aws/
$LambdaDir = Join-Path $Root 'lambda'
$Template = Join-Path $Root 'infrastructure\template.yaml'

if (-not $ArtifactBucket) { $ArtifactBucket = "nova-escalations-artifacts-$([guid]::NewGuid().ToString('N').Substring(0,10))" }
if (-not $StackName) { $StackName = 'nova-escalations' }
if (-not $Region) { $Region = 'us-east-1' }

Write-Host "==> Checking prerequisites" -ForegroundColor Cyan
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) { throw "AWS CLI not installed. Install from https://aws.amazon.com/cli/" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js not installed." }

$awsArgs = @()
if ($Profile) { $awsArgs += @('--profile', $Profile) }
if ($Region)  { $awsArgs += @('--region', $Region) }

Write-Host "==> Installing Lambda dependencies" -ForegroundColor Cyan
Push-Location $LambdaDir
try {
  npm ci --omit=dev
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
  Write-Host "==> Packaging Lambda (function.zip)" -ForegroundColor Cyan
  node scripts/package.js
  if ($LASTEXITCODE -ne 0) { throw 'Lambda packaging failed' }
} finally {
  Pop-Location
}

Write-Host "==> Ensuring artifact bucket: $ArtifactBucket" -ForegroundColor Cyan
& aws $awsArgs s3 mb "s3://$ArtifactBucket" 2>$null
if ($LASTEXITCODE -ne 0) {
  # bucket may already exist
  & aws $awsArgs s3api head-bucket --bucket $ArtifactBucket
  if ($LASTEXITCODE -ne 0) { throw "Could not create/access artifact bucket $ArtifactBucket" }
}

Write-Host "==> Uploading Lambda bundle" -ForegroundColor Cyan
& aws $awsArgs s3 cp (Join-Path $LambdaDir 'function.zip') "s3://$ArtifactBucket/escalations/lambda/function.zip"
if ($LASTEXITCODE -ne 0) { throw 'Upload failed' }

Write-Host "==> Deploying CloudFormation stack: $StackName" -ForegroundColor Cyan
$paramArgs = @(
  "ArtifactBucket=$ArtifactBucket",
  "ArtifactKey=escalations/lambda/function.zip"
)
if ($AlarmEmail)  { $paramArgs += "AlarmEmail=$AlarmEmail" }
if ($ApiCallbackUrl) { $paramArgs += "ApiCallbackUrl=$ApiCallbackUrl" }

& aws $awsArgs cloudformation deploy `
  --template-file $Template `
  --stack-name $StackName `
  --parameter-overrides $paramArgs `
  --capabilities CAPABILITY_IAM
if ($LASTEXITCODE -ne 0) { throw 'CloudFormation deploy failed' }

Write-Host "==> Stack outputs" -ForegroundColor Green
& aws $awsArgs cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].Outputs" --output table