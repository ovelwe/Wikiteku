import { changeFavorite } from "@/app/community-actions";
import { communityCopy } from "@/lib/community";
import { getLocale } from "@/server/community";
import { FavoriteButton } from "./favorite-button";

export async function FavoriteForm({
  fandomId,
  saved,
}: {
  fandomId: string;
  saved: boolean;
}) {
  const t = communityCopy[await getLocale()];
  return (
    <form action={changeFavorite.bind(null, fandomId)}>
      <FavoriteButton
        saved={saved}
        saveLabel={t.save}
        removeLabel={t.remove}
        pendingLabel={t.pending}
      />
    </form>
  );
}
