import pytest

ORGANIZATIONS = [
    {
        "id": "org-northgate",
        "name": "Northgate Student Services",
        "personSingular": "Student",
        "personPlural": "Students",
        "backdropUrl": "/backdrops/northgate.jpg",
    },
    {
        "id": "org-riverside",
        "name": "Riverside Family Clinic",
        "personSingular": "Patient",
        "personPlural": "Patients",
        "backdropUrl": "/backdrops/riverside.jpg",
    },
]


def test_lists_organizations(client):
    response = client.get("/api/organizations")
    assert response.status_code == 200, response.text
    assert response.json() == ORGANIZATIONS


@pytest.mark.parametrize(
    "headers",
    [{"Authorization": "Bearer unknown-token"}, {"Authorization": "Basic abc123"}],
    ids=["unknown-token", "wrong-scheme"],
)
def test_bad_token_is_ignored(client, headers):
    response = client.get("/api/organizations", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json() == ORGANIZATIONS


@pytest.mark.parametrize("user_id", ["u-1", "a-1"], ids=["visitor", "admin"])
def test_logged_in_users_see_all_organizations(login_as, user_id):
    response = login_as(user_id).get("/api/organizations")
    assert response.status_code == 200, response.text
    assert response.json() == ORGANIZATIONS
