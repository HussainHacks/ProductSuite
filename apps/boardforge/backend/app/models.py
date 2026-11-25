from productsuite_database import Base, TimestampMixin
from sqlalchemy import JSON, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column


class Whiteboard(Base, TimestampMixin):
    """A persistent whiteboard canvas with optimistic-concurrency version field."""

    __tablename__ = "wb_boards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    viewport_x: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    viewport_y: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    viewport_zoom: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    elements: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
