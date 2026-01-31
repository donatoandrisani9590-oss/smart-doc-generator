import os
from celery import Celery

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

celery_app = Celery(
    "docgen_worker",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.retention",
        "app.tasks.bulk_tasks",
        "app.tasks.pdf_tasks",
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Berlin",
    enable_utc=True,
)

# Beat Schedule
celery_app.conf.beat_schedule = {
    "run-retention-policy-daily": {
        "task": "app.tasks.retention.enforce_retention_policies",
        "schedule": 86400.0, # Every 24 hours
    },
}
