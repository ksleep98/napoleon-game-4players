# Repository Configuration
# Note: This manages an existing repository. Import it first with:
# terraform import github_repository.napoleon_game napoleon-game-4players

resource "github_repository" "napoleon_game" {
  name         = var.repository_name
  description  = var.repository_description
  visibility   = "public"
  homepage_url = "https://napoleon-game-4players.vercel.app"

  # Features
  has_issues      = true
  has_discussions = false
  has_projects    = true
  has_wiki        = false

  # Merge options
  allow_merge_commit     = true   # develop -> main: 通常マージ
  allow_squash_merge     = true   # feature -> develop: スカッシュマージ
  allow_rebase_merge     = false  # リベースマージ無効
  allow_auto_merge       = false  # 自動マージ無効（手動マージのみ）
  delete_branch_on_merge = true   # マージ後ブランチ自動削除

  # Security
  vulnerability_alerts = true

  # Archive settings
  archived           = false
  archive_on_destroy = false
}

# Repository Ruleset: develop (development integration)
resource "github_repository_ruleset" "develop" {
  name        = "develop"
  repository  = github_repository.napoleon_game.name
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["refs/heads/${var.default_branch}"]
      exclude = []
    }
  }

  bypass_actors {
    actor_id    = 5  # Repository admin
    actor_type  = "RepositoryRole"
    bypass_mode = "pull_request"
  }

  rules {
    # ブランチ保護ルール
    creation         = true  # ブランチ作成禁止
    deletion         = true  # ブランチ削除禁止
    non_fast_forward = true  # Force push禁止

    # Pull Request必須 + スカッシュマージのみ許可
    pull_request {
      dismiss_stale_reviews_on_push     = true
      require_code_owner_review         = false
      require_last_push_approval        = false
      required_approving_review_count   = 0  # 個人開発のためレビュー不要
      required_review_thread_resolution = true
      allowed_merge_methods             = ["squash"]  # feature -> develop: スカッシュマージのみ
    }

    # CI必須
    required_status_checks {
      required_check {
        context = "ci-check"
      }
      strict_required_status_checks_policy = true
    }
  }
}

# Repository Ruleset: main (production)
resource "github_repository_ruleset" "main" {
  name        = "main"
  repository  = github_repository.napoleon_game.name
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["refs/heads/${var.production_branch}"]
      exclude = []
    }
  }

  bypass_actors {
    actor_id    = 5  # Repository admin
    actor_type  = "RepositoryRole"
    bypass_mode = "pull_request"
  }

  rules {
    # ブランチ保護ルール
    creation         = true  # ブランチ作成禁止
    deletion         = true  # ブランチ削除禁止
    non_fast_forward = true  # Force push禁止

    # Pull Request必須 + 通常マージのみ許可
    pull_request {
      dismiss_stale_reviews_on_push     = true
      require_code_owner_review         = false
      require_last_push_approval        = false
      required_approving_review_count   = 0  # 個人開発のためレビュー不要
      required_review_thread_resolution = true
      allowed_merge_methods             = ["merge"]  # develop -> main: 通常マージのみ
    }

    # CI必須
    required_status_checks {
      required_check {
        context = "ci-check"
      }
      strict_required_status_checks_policy = true
    }
  }
}

# Issue Labels
resource "github_issue_label" "bug" {
  repository  = github_repository.napoleon_game.name
  name        = "bug"
  color       = "d73a4a"
  description = "Something isn't working"
}

resource "github_issue_label" "enhancement" {
  repository  = github_repository.napoleon_game.name
  name        = "enhancement"
  color       = "a2eeef"
  description = "New feature or request"
}

resource "github_issue_label" "documentation" {
  repository  = github_repository.napoleon_game.name
  name        = "documentation"
  color       = "0075ca"
  description = "Improvements or additions to documentation"
}

resource "github_issue_label" "security" {
  repository  = github_repository.napoleon_game.name
  name        = "security"
  color       = "ee0701"
  description = "Security-related issues"
}

resource "github_issue_label" "performance" {
  repository  = github_repository.napoleon_game.name
  name        = "performance"
  color       = "f9d0c4"
  description = "Performance improvements"
}

resource "github_issue_label" "refactoring" {
  repository  = github_repository.napoleon_game.name
  name        = "refactoring"
  color       = "fbca04"
  description = "Code refactoring"
}

resource "github_issue_label" "test" {
  repository  = github_repository.napoleon_game.name
  name        = "test"
  color       = "bfdadc"
  description = "Testing-related changes"
}

resource "github_issue_label" "dependencies" {
  repository  = github_repository.napoleon_game.name
  name        = "dependencies"
  color       = "0366d6"
  description = "Dependency updates"
}
