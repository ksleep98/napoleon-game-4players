FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 依存の唯一のソースは uv.lock。requirements.txt はリポジトリに置かず、
# ここで `uv export` して導出する。
#
# 生成物をコミットしていた頃、Dependabot はそれを uv.lock とは独立に編集し、
# 推移的依存のピンを他の制約と両立しない版に単独で上げていた（#520 / #527 は
# どちらも tomlkit を 0.15.1 に上げようとしたが、gradio 6.22.0 は
# tomlkit<0.15.0 を要求するため解決不能）。同じ組み合わせが実際にこの Docker
# ビルドを ResolutionImpossible で落としている（#509 で修正）。Space は別
# リポジトリで再デプロイ時にしかビルドされないため、発覚まで数か月かかった。
# ファイルを持たなければこの経路自体が消える。
ARG UV_VERSION=0.8.14
ARG EXPORTED_REQUIREMENTS=requirements.export.txt

WORKDIR /app

# 依存定義だけを先に COPY し、ソース変更でこのレイヤが無効化されないようにする。
COPY pyproject.toml uv.lock ./

# uv・導出した requirements・uv のキャッシュは同一レイヤ内で捨てる
# （別レイヤで消してもイメージサイズには残るため）。
RUN pip install --no-cache-dir "uv==${UV_VERSION}" \
    && uv export --no-cache --no-hashes --no-dev --no-header --format requirements-txt \
        > "${EXPORTED_REQUIREMENTS}" \
    && pip install --no-cache-dir -r "${EXPORTED_REQUIREMENTS}" \
    && pip uninstall -y uv \
    && rm -f "${EXPORTED_REQUIREMENTS}" \
    && rm -rf /root/.cache/uv /root/.local/share/uv

COPY . .

# Hugging Face Spaces routes traffic to port 7860.
EXPOSE 7860

CMD ["python", "app.py"]
