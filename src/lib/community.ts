import { z } from "zod";

export const favoriteMutation = z.object({
  fandomId: z.string().uuid(),
  action: z.enum(["save", "remove"]),
});
export const favoriteLimit = 100;

export const communityCopy = {
  ru: {
    favorites: "Избранное",
    activity: "Обновления",
    members: "Участники",
    save: "В избранное",
    saved: "В избранном",
    remove: "Убрать из избранного",
    pending: "Сохраняем…",
    favoritesIntro: "Ваши сообщества и новые страницы — всегда под рукой.",
    activityIntro:
      "Последние изменения опубликованных статей в избранных фандомах.",
    empty: "Здесь будут ваши любимые фандомы",
    emptyHint: "Откройте сообщество и нажмите «В избранное».",
    explore: "Найти фандомы",
    noUpdates: "Пока нет доступных обновлений",
    noUpdatesHint:
      "В ленте появятся опубликованные статьи из ваших избранных сообществ.",
    unavailable: "Сообщество недоступно",
    unavailableHint:
      "Оно закрыто или у вас больше нет доступа. Вы можете убрать его из избранного.",
    back: "Назад",
    next: "Дальше",
    updated: "Обновлено",
    revision: "Версия",
    manage: "Управление участниками",
    membersIntro: "Люди, которые читают и развивают это сообщество.",
    limit: "Можно сохранить до 100 фандомов.",
    denied: "Фандом недоступен или параметры неверны.",
    roles: {
      owner: "Владелец",
      admin: "Администратор",
      editor: "Редактор",
      reader: "Читатель",
    },
  },
  en: {
    favorites: "Favorites",
    activity: "Updates",
    members: "Members",
    save: "Add to favorites",
    saved: "Saved",
    remove: "Remove from favorites",
    pending: "Saving…",
    favoritesIntro:
      "Your communities and their latest pages, all in one place.",
    activityIntro:
      "Latest changes to published articles in your favorite fandoms.",
    empty: "A home for your favorite fandoms",
    emptyHint: "Open a community and select “Add to favorites”.",
    explore: "Explore fandoms",
    noUpdates: "No updates available yet",
    noUpdatesHint:
      "Published articles from your favorite communities will appear here.",
    unavailable: "Community unavailable",
    unavailableHint:
      "It is private or you no longer have access. You can remove it from your favorites.",
    back: "Previous",
    next: "Next",
    updated: "Updated",
    revision: "Revision",
    manage: "Manage members",
    membersIntro: "The people who read and build this community.",
    limit: "You can save up to 100 fandoms.",
    denied: "This fandom is unavailable or the request is invalid.",
    roles: {
      owner: "Owner",
      admin: "Administrator",
      editor: "Editor",
      reader: "Reader",
    },
  },
} as const;
