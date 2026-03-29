terraform {
  required_version = ">= 1.0"

  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  # Terraform Cloud configuration
  cloud {
    organization = "ksleep98"  # Replace with your Terraform Cloud organization name

    workspaces {
      name = "napoleon-game-4players"
    }
  }
}

# GitHub Provider
provider "github" {
  owner = var.github_owner
  token = var.github_token
}
