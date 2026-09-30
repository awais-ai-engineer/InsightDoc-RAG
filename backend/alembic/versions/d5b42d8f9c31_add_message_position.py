"""add message position

Revision ID: d5b42d8f9c31
Revises: c4a31c7e8b20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d5b42d8f9c31"
down_revision: Union[str, Sequence[str], None] = "c4a31c7e8b20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("position", sa.Integer(), nullable=True))
    op.execute("""
        WITH numbered AS (
            SELECT id, row_number() OVER (PARTITION BY chat_id ORDER BY created_at, id) AS position
            FROM messages
        )
        UPDATE messages SET position = numbered.position FROM numbered WHERE messages.id = numbered.id
    """)
    op.alter_column("messages", "position", nullable=False)
    op.create_unique_constraint("uq_messages_chat_position", "messages", ["chat_id", "position"])


def downgrade() -> None:
    op.drop_constraint("uq_messages_chat_position", "messages", type_="unique")
    op.drop_column("messages", "position")
