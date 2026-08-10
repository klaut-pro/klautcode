<p align="center">
  <a href="https://code.klaut.pro">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Klautcode logo">
    </picture>
  </a>
</p>
<p align="center">Открытый AI-агент для программирования.</p>
<p align="center">
  <a href="https://code.klaut.pro/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/klautcode-ai"><img alt="npm" src="https://img.shields.io/npm/v/klautcode-ai?style=flat-square" /></a>
  <a href="https://github.com/klaut-pro/klautcode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/klaut-pro/klautcode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![Klautcode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://code.klaut.pro)

---

### Установка

```bash
# YOLO
curl -fsSL https://code.klaut.pro/install | bash

# Менеджеры пакетов
npm i -g klautcode-ai@latest        # или bun/pnpm/yarn
scoop install klautcode             # Windows
choco install klautcode             # Windows
brew install klaut-pro/tap/klautcode # macOS и Linux (рекомендуем, всегда актуально)
brew install klautcode              # macOS и Linux (официальная формула brew, обновляется реже)
sudo pacman -S klautcode            # Arch Linux (Stable)
paru -S klautcode-bin               # Arch Linux (Latest from AUR)
mise use -g klautcode               # любая ОС
nix run nixpkgs#klautcode           # или github:klaut-pro/klautcode для самой свежей ветки dev
```

> [!TIP]
> Перед установкой удалите версии старше 0.1.x.

### Десктопное приложение (BETA)

Klautcode также доступен как десктопное приложение. Скачайте его со [страницы релизов](https://github.com/klaut-pro/klautcode/releases) или с [code.klaut.pro/download](https://code.klaut.pro/download).

| Платформа             | Загрузка                           |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `klautcode-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `klautcode-desktop-mac-x64.dmg`     |
| Windows               | `klautcode-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm` или AppImage        |

```bash
# macOS (Homebrew)
brew install --cask klautcode-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/klautcode-desktop
```

#### Каталог установки

Скрипт установки выбирает путь установки в следующем порядке приоритета:

1. `$KLAUTCODE_INSTALL_DIR` - Пользовательский каталог установки
2. `$XDG_BIN_DIR` - Путь, совместимый со спецификацией XDG Base Directory
3. `$HOME/bin` - Стандартный каталог пользовательских бинарников (если существует или можно создать)
4. `$HOME/.klautcode/bin` - Fallback по умолчанию

```bash
# Примеры
KLAUTCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://code.klaut.pro/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://code.klaut.pro/install | bash
```

### Agents

В Klautcode есть два встроенных агента, между которыми можно переключаться клавишей `Tab`.

- **build** - По умолчанию, агент с полным доступом для разработки
- **plan** - Агент только для чтения для анализа и изучения кода
  - По умолчанию запрещает редактирование файлов
  - Запрашивает разрешение перед выполнением bash-команд
  - Идеален для изучения незнакомых кодовых баз или планирования изменений

Также включен сабагент **general** для сложных поисков и многошаговых задач.
Он используется внутренне и может быть вызван в сообщениях через `@general`.

Подробнее об [agents](https://code.klaut.pro/docs/agents).

### Документация

Больше информации о том, как настроить Klautcode: [**наши docs**](https://code.klaut.pro/docs).

### Вклад

Если вы хотите внести вклад в Klautcode, прочитайте [contributing docs](./CONTRIBUTING.md) перед тем, как отправлять pull request.

### Разработка на базе Klautcode

Если вы делаете проект, связанный с Klautcode, и используете "klautcode" как часть имени (например, "klautcode-dashboard" или "klautcode-mobile"), добавьте примечание в README, чтобы уточнить, что проект не создан командой Klautcode и не аффилирован с нами.

---

**Присоединяйтесь к нашему сообществу** [Discord](https://discord.gg/klautcode) | [X.com](https://x.com/klautcode)
