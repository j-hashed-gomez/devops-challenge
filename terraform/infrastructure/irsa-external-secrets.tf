# IAM Policy for External Secrets Operator to access AWS Secrets Manager
data "aws_iam_policy_document" "external_secrets" {
  statement {
    sid    = "SecretsManagerAccess"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
      "secretsmanager:ListSecrets"
    ]
    resources = [
      "arn:aws:secretsmanager:eu-west-1:*:secret:tech-challenge/*",
      "arn:aws:secretsmanager:eu-west-1:*:secret:observability/*"
    ]
  }

  statement {
    sid    = "ParameterStoreAccess"
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath"
    ]
    resources = [
      "arn:aws:ssm:eu-west-1:*:parameter/tech-challenge/*"
    ]
  }
}

resource "aws_iam_policy" "external_secrets" {
  name        = "tech-challenge-external-secrets-policy"
  description = "IAM policy for External Secrets Operator to access AWS Secrets Manager"
  policy      = data.aws_iam_policy_document.external_secrets.json

  tags = {
    Name = "tech-challenge-external-secrets-policy"
  }
}

# IRSA for External Secrets Operator
data "aws_iam_policy_document" "external_secrets_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.eks.arn]
    }

    actions = ["sts:AssumeRoleWithWebIdentity"]

    condition {
      test     = "StringEquals"
      variable = "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub"
      values   = ["system:serviceaccount:external-secrets:external-secrets"]
    }

    condition {
      test     = "StringEquals"
      variable = "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "external_secrets" {
  name               = "tech-challenge-external-secrets-sa"
  assume_role_policy = data.aws_iam_policy_document.external_secrets_assume_role.json

  tags = {
    Name           = "tech-challenge-external-secrets-sa"
    ServiceAccount = "external-secrets"
    Namespace      = "external-secrets"
  }
}

resource "aws_iam_role_policy_attachment" "external_secrets" {
  role       = aws_iam_role.external_secrets.name
  policy_arn = aws_iam_policy.external_secrets.arn
}
