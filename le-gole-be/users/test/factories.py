import factory
from django.contrib.auth import get_user_model

from users.models import Cliente

Utente = get_user_model()


class UtenteFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Utente
        skip_postgeneration_save = True

    username = factory.Sequence(lambda n: f"staff{n}")
    email = factory.LazyAttribute(lambda o: f"{o.username}@example.com")
    is_staff = True
    is_superuser = False
    is_active = True

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        self.set_password(extracted or "SuperSegreta123!")
        if create:
            self.save()


class SuperUserFactory(UtenteFactory):
    is_superuser = True


class ClienteFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Cliente

    nome = factory.Sequence(lambda n: f"Cliente Test {n}")
    telefono = factory.Sequence(lambda n: f"33300{n:05d}")
