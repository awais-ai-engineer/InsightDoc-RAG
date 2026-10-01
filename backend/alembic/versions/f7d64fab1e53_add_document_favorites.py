"""add document favorites

Revision ID: f7d64fab1e53
Revises: e6c53e9a0d42
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "f7d64fab1e53"
down_revision: Union[str, Sequence[str], None] = "e6c53e9a0d42"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("documents", sa.Column("is_favorite", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.alter_column("documents", "is_favorite", server_default=None)

def downgrade() -> None:
    op.drop_column("documents", "is_favorite")
