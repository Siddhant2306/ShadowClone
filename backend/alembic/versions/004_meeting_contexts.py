"""Persist owner-provided context for each meeting."""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"


def upgrade():
    op.create_table(
        "meeting_contexts",
        sa.Column(
            "conversation_id",
            sa.String(),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.Integer(), nullable=False),
    )
    op.create_index(
        "ix_meeting_contexts_user_id", "meeting_contexts", ["user_id"]
    )


def downgrade():
    op.drop_table("meeting_contexts")
