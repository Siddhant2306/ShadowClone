from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"


def upgrade():
    op.create_table(
        "conversations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("channel", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("transcript", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.Integer(), nullable=False),
    )
    op.create_index("ix_conversations_user_id", "conversations", ["user_id"])


def downgrade():
    op.drop_table("conversations")
