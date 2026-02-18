"""Tests for the onboarding package pipeline."""
import json
import pytest
from unittest.mock import AsyncMock, patch

from app.services.onboarding_packages import (
    detect_package_from_text, get_package, ONBOARDING_PACKAGES,
)
from app.services.onboarding_service import extract_employee_data


class TestPackageDefinitions:
    """Test package detection and lookup."""

    def test_detect_onboarding(self):
        assert detect_package_from_text("Onboarding für Anna") == "onboarding"

    def test_detect_kuendigung(self):
        assert detect_package_from_text("Kündigung von Max") == "kuendigung"

    def test_detect_befoerderung(self):
        assert detect_package_from_text("Beförderung von Lisa") == "befoerderung"

    def test_detect_einstellen(self):
        assert detect_package_from_text("Neuer Mitarbeiter einstellen") == "onboarding"

    def test_detect_unknown(self):
        assert detect_package_from_text("Hallo Welt") is None

    def test_get_package_valid(self):
        pkg = get_package("onboarding")
        assert pkg is not None
        assert "Arbeitsvertrag" in pkg["document_types"]

    def test_get_package_invalid(self):
        assert get_package("nonexistent") is None

    def test_all_packages_have_required_keys(self):
        for key, pkg in ONBOARDING_PACKAGES.items():
            assert "name" in pkg
            assert "description" in pkg
            assert "document_types" in pkg
            assert "shared_fields" in pkg
            assert len(pkg["document_types"]) > 0


class TestExtractEmployeeData:
    """Test LLM extraction with mocked LLM."""

    @pytest.mark.asyncio
    async def test_extract_basic_data(self):
        mock_response = AsyncMock()
        mock_response.content = json.dumps({
            "vorname": "Anna",
            "nachname": "Müller",
            "position": "Developer",
            "gehalt": "70000",
            "package_key": "onboarding",
        })

        with patch("app.services.onboarding_service.get_llm_service") as mock_llm:
            mock_service = AsyncMock()
            mock_service.chat.return_value = mock_response
            mock_llm.return_value = mock_service

            result = await extract_employee_data(
                "Onboarding für Anna Müller, Developer, 70k"
            )

            assert result["vorname"] == "Anna"
            assert result["nachname"] == "Müller"
            assert result["package_key"] == "onboarding"

    @pytest.mark.asyncio
    async def test_extract_fallback_package_detection(self):
        """If LLM doesn't return package_key, detect from keywords."""
        mock_response = AsyncMock()
        mock_response.content = json.dumps({
            "vorname": "Max",
            "nachname": "Schmidt",
        })

        with patch("app.services.onboarding_service.get_llm_service") as mock_llm:
            mock_service = AsyncMock()
            mock_service.chat.return_value = mock_response
            mock_llm.return_value = mock_service

            result = await extract_employee_data(
                "Kündigung von Max Schmidt"
            )

            assert result["package_key"] == "kuendigung"

    @pytest.mark.asyncio
    async def test_extract_handles_non_json(self):
        """If LLM returns non-JSON, fallback gracefully."""
        mock_response = AsyncMock()
        mock_response.content = "Sorry, I can't parse that."

        with patch("app.services.onboarding_service.get_llm_service") as mock_llm:
            mock_service = AsyncMock()
            mock_service.chat.return_value = mock_response
            mock_llm.return_value = mock_service

            result = await extract_employee_data("something weird")

            assert isinstance(result, dict)
