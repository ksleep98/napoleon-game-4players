variable "github_owner" {
  description = "GitHub repository owner (username or organization)"
  type        = string
  default     = "ksleep98"
}

variable "github_token" {
  description = "GitHub Personal Access Token (PAT) with repo and admin:repo_hook scopes"
  type        = string
  sensitive   = true
}

variable "repository_name" {
  description = "GitHub repository name"
  type        = string
  default     = "napoleon-game-4players"
}

variable "repository_description" {
  description = "Repository description"
  type        = string
  default     = "トランプでのナポレオンゲームの4人用Webアプリ"
}

variable "default_branch" {
  description = "Default branch name"
  type        = string
  default     = "develop"
}

variable "production_branch" {
  description = "Production branch name"
  type        = string
  default     = "main"
}
