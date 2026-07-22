from django.urls import path
from predictor.views import (
    analyze_project,
    download_report,
    save_corrected_report
)

urlpatterns = [

    path(
        "api/analyze/",
        analyze_project,
        name="analyze_project"
    ),

    path(
        "api/save-report/",
        save_corrected_report,
        name="save_corrected_report"
    ),

    path(
        "download-report/",
        download_report,
        name="download_report"
    ),

]