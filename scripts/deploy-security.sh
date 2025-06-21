#!/bin/bash

# Deploy CloudFront + WAF Security for Figma Plugin
# This script sets up CloudFront distribution with WAF protection for the Lambda URL

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🛡️  Deploying Security Infrastructure for Figma Plugin${NC}"

# Check if AWS CLI is installed and configured
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install AWS CLI and configure credentials.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Creating WAF Web ACL...${NC}"

# Create WAF Web ACL
WAF_ARN=$(aws wafv2 create-web-acl \
    --scope CLOUDFRONT \
    --cli-input-json file://aws-configs/waf-rules.json \
    --region us-east-1 \
    --query 'Summary.ARN' \
    --output text)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ WAF Web ACL created: ${WAF_ARN}${NC}"
else
    echo -e "${RED}❌ Failed to create WAF Web ACL${NC}"
    exit 1
fi

echo -e "${YELLOW}🌐 Creating CloudFront Distribution...${NC}"

# Update CloudFront config with WAF ARN
TEMP_CONFIG=$(mktemp)
cat aws-configs/cloudfront-distribution.json | \
    jq --arg waf_arn "$WAF_ARN" '.WebACLId = $waf_arn | .CallerReference = ("figma-plugin-security-" + (now | tostring))' \
    > "$TEMP_CONFIG"

# Create CloudFront Distribution
DISTRIBUTION_RESULT=$(aws cloudfront create-distribution \
    --distribution-config file://"$TEMP_CONFIG" \
    --query '{Id: Distribution.Id, DomainName: Distribution.DomainName, Status: Distribution.Status}' \
    --output json)

if [ $? -eq 0 ]; then
    CLOUDFRONT_ID=$(echo "$DISTRIBUTION_RESULT" | jq -r '.Id')
    CLOUDFRONT_DOMAIN=$(echo "$DISTRIBUTION_RESULT" | jq -r '.DomainName')
    
    echo -e "${GREEN}✅ CloudFront Distribution created:${NC}"
    echo -e "   Distribution ID: ${CLOUDFRONT_ID}"
    echo -e "   Domain Name: ${CLOUDFRONT_DOMAIN}"
    echo -e "   Status: Deploying (this may take 10-15 minutes)"
else
    echo -e "${RED}❌ Failed to create CloudFront Distribution${NC}"
    exit 1
fi

# Clean up temp file
rm "$TEMP_CONFIG"

echo -e "${YELLOW}⏳ Waiting for CloudFront distribution to deploy...${NC}"
echo -e "${YELLOW}   This usually takes 10-15 minutes. You can check status with:${NC}"
echo -e "   aws cloudfront get-distribution --id ${CLOUDFRONT_ID}"

# Save configuration for later use
cat > aws-configs/deployment-info.json << EOF
{
  "cloudfront": {
    "distributionId": "${CLOUDFRONT_ID}",
    "domainName": "${CLOUDFRONT_DOMAIN}",
    "url": "https://${CLOUDFRONT_DOMAIN}"
  },
  "waf": {
    "arn": "${WAF_ARN}"
  },
  "original_lambda_url": "https://45eu4yy74z3uljhe74ogyda4bm0stwqt.lambda-url.ap-northeast-1.on.aws/",
  "deployment_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo -e "${GREEN}✅ Security infrastructure deployment initiated!${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "   1. Wait for CloudFront distribution to finish deploying"
echo -e "   2. Update Figma plugin to use: https://${CLOUDFRONT_DOMAIN}"
echo -e "   3. Test the new secured endpoint"
echo -e "   4. Monitor WAF metrics in CloudWatch"

echo -e "${GREEN}🔒 Security features enabled:${NC}"
echo -e "   • Rate limiting: 100 requests per 5 minutes per IP"
echo -e "   • Common attack protection (OWASP Top 10)"
echo -e "   • Known bad inputs blocking"
echo -e "   • Suspicious user agent blocking"
echo -e "   • HTTPS-only access"
echo -e "   • CloudWatch monitoring"