"""Consented voice embeddings."""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"


def upgrade():
    op.create_table(
        "voice_profiles",
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("embedding", sa.JSON(), nullable=False),
        sa.Column("consent_at", sa.Integer(), nullable=False),
    )


def downgrade():
    op.drop_table("voice_profiles")
