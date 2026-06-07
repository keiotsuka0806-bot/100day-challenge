const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');
const signupForm = document.querySelector('#signupForm');
const formNote = document.querySelector('#formNote');

navToggle?.addEventListener('click', () => {
  const isOpen = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

siteNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    siteNav.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });
});

signupForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  const email = String(formData.get('email') || '').trim();

  if (!email) return;

  formNote.textContent = '登録リクエストを受け付けました。初回リリース時にご案内します。';
  formNote.classList.add('success');
  signupForm.reset();
});
