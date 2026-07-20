from rest_framework.permissions import BasePermission


class IsSuperUser(BasePermission):
    """
    Riserva la gestione degli account Staff/Admin a chi gestisce la piattaforma:
    essere autenticati e is_staff non basta, serve is_superuser=True.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_superuser)
