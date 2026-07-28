from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


def send_activation_email(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    # NON conosco il tuo deep-link scheme definitivo: adatta questo valore
    # a come hai configurato React Native (es. "ristorantexyz://activate")
    activation_link = f"{settings.FRONTEND_ACTIVATION_URL}?uid={uid}&token={token}"

    send_mail(
        subject="Attiva il tuo account staff",
        message=(
            f"Ciao {user.username},\n\n"
            f"Il tuo account staff è stato creato. Per attivarlo e impostare "
            f"la tua password, apri questo link:\n\n{activation_link}\n\n"
            f"Il link scade dopo un certo periodo di inattività per motivi di sicurezza."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )

def send_password_reset_email(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    reset_link = f"{settings.FRONTEND_RESET_URL}?uid={uid}&token={token}"

    send_mail(
        subject="Reimposta la tua password",
        message=(
            f"Ciao {user.username},\n\n"
            f"Hai richiesto di reimpostare la password. Apri questo link "
            f"per sceglierne una nuova:\n\n{reset_link}\n\n"
            f"Se non hai richiesto tu questa operazione, ignora questa email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )