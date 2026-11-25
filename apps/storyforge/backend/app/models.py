from productsuite_database import Base, TimestampMixin
from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Story(Base, TimestampMixin):
    """An interactive story, report, or presentation."""

    __tablename__ = "sf_stories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(400), default="", nullable=False)
    layout: Mapped[str] = mapped_column(String(32), default="vertical_scroll", nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    public_slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    cards: Mapped[list["StoryCard"]] = relationship(
        "StoryCard",
        back_populates="story",
        cascade="all, delete-orphan",
        order_by="StoryCard.position",
    )


class StoryCard(Base, TimestampMixin):
    """A content card inside a StoryForge story."""

    __tablename__ = "sf_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    story_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sf_stories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    card_type: Mapped[str] = mapped_column(String(24), nullable=False)
    title: Mapped[str] = mapped_column(String(240), default="", nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    media_url: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    story: Mapped[Story] = relationship("Story", back_populates="cards")
