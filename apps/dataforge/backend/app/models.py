from enum import StrEnum

from productsuite_database import Base, TimestampMixin
from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship


class FieldType(StrEnum):
    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    BOOLEAN = "boolean"
    SINGLE_SELECT = "single_select"
    MULTIPLE_SELECT = "multiple_select"
    EMAIL = "email"
    URL = "url"


class DataList(Base, TimestampMixin):
    """A user-defined structured list without dynamic DDL tables."""

    __tablename__ = "df_lists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)

    columns: Mapped[list["ListColumn"]] = relationship(
        "ListColumn",
        back_populates="data_list",
        cascade="all, delete-orphan",
        order_by="ListColumn.position",
    )
    records: Mapped[list["ListRecord"]] = relationship(
        "ListRecord",
        back_populates="data_list",
        cascade="all, delete-orphan",
        order_by="ListRecord.id.asc()",
    )


class ListColumn(Base, TimestampMixin):
    """Column schema definition for a DataList."""

    __tablename__ = "df_columns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    list_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("df_lists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    field_type: Mapped[str] = mapped_column(String(32), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    options: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    data_list: Mapped[DataList] = relationship("DataList", back_populates="columns")


class ListRecord(Base, TimestampMixin):
    """A flexible JSON-backed row inside a DataList."""

    __tablename__ = "df_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    list_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("df_lists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    values: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    data_list: Mapped[DataList] = relationship("DataList", back_populates="records")
