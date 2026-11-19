"""SQL execution and ORM lifecycle tracing; no credentials or voice embeddings."""

import time
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session
from app.diagnostics import emit


def install_database_debug(engine):
    @event.listens_for(engine, "before_cursor_execute")
    def before_sql(conn, cursor, statement, parameters, context, executemany):
        context.debug_started = time.perf_counter()
        # SQL is parameterized. Authentication/voice parameters are omitted entirely.
        sensitive = any(
            word in statement.lower()
            for word in ("password", "token", "embedding", "login_sessions")
        )
        emit(
            "db.query",
            statement=statement,
            executemany=executemany,
            content={
                "parameters": (
                    "[sensitive table parameters omitted]" if sensitive else parameters
                )
            },
        )

    @event.listens_for(engine, "after_cursor_execute")
    def after_sql(conn, cursor, statement, parameters, context, executemany):
        emit(
            "db.query.complete",
            rowcount=cursor.rowcount,
            elapsed_ms=round((time.perf_counter() - context.debug_started) * 1000, 2),
        )

    @event.listens_for(engine, "handle_error")
    def sql_error(context):
        emit("db.query.error", error_type=type(context.original_exception).__name__)


def snapshot(instance):
    state = inspect(instance)
    return {
        column.key: state.dict[column.key]
        for column in state.mapper.column_attrs
        if column.key in state.dict
    }


@event.listens_for(Session, "before_flush")
def before_flush(session, flush_context, instances):
    for operation, rows in (
        ("insert", session.new),
        ("update", session.dirty),
        ("delete", session.deleted),
    ):
        for row in rows:
            emit(
                "db.write.pending",
                operation=operation,
                table=inspect(row).mapper.local_table.name,
                content=snapshot(row),
            )


@event.listens_for(Session, "loaded_as_persistent")
def loaded(session, instance):
    emit(
        "db.row.loaded",
        table=inspect(instance).mapper.local_table.name,
        content=snapshot(instance),
    )


@event.listens_for(Session, "after_commit")
def committed(session):
    emit("db.transaction.commit")


@event.listens_for(Session, "after_rollback")
def rolled_back(session):
    emit("db.transaction.rollback")
