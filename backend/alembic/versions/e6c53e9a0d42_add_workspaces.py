"""add workspaces

Revision ID: e6c53e9a0d42
Revises: d5b42d8f9c31
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "e6c53e9a0d42"
down_revision: Union[str, Sequence[str], None] = "d5b42d8f9c31"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("workspaces", sa.Column("id", sa.UUID(), nullable=False), sa.Column("user_id", sa.UUID(), nullable=False), sa.Column("name", sa.String(120), nullable=False), sa.Column("description", sa.Text(), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False), sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"))
    op.create_index("ix_workspaces_user_id", "workspaces", ["user_id"])
    op.add_column("documents", sa.Column("workspace_id", sa.UUID(), nullable=True))
    op.create_foreign_key("fk_documents_workspace_id", "documents", "workspaces", ["workspace_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_documents_workspace_id", "documents", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("ix_documents_workspace_id", table_name="documents")
    op.drop_constraint("fk_documents_workspace_id", "documents", type_="foreignkey")
    op.drop_column("documents", "workspace_id")
    op.drop_index("ix_workspaces_user_id", table_name="workspaces")
    op.drop_table("workspaces")
