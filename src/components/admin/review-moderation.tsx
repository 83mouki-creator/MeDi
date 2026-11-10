'use client';

import { useActionState } from 'react';
import { Check, EyeOff, Loader2, MessageSquareReply } from 'lucide-react';
import { moderateReviewAction, type ModerationState } from '@/app/actions/reviews';
import { useAdminI18n } from '@/components/admin/admin-i18n';
import { Alert } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import type { ReviewStatus } from '@/lib/review-shared';

const initial: ModerationState = {};

/**
 * Modération d'un avis : publier, masquer, répondre.
 *
 * Trois gestes, dans l'ordre où l'équipe les fait réellement : lire, décider,
 * éventuellement répondre. La réponse est **publique** et signée par la
 * boutique — d'où le rappel au-dessus du champ.
 */
export function ReviewModerationForm({
  kind,
  id,
  status,
  reply,
}: {
  kind: 'product' | 'delivery';
  id: string;
  status: ReviewStatus;
  reply: string | null;
}) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(moderateReviewAction, initial);

  return (
    <div className="mt-3 space-y-2 border-t border-navy-100 pt-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {status !== 'PUBLISHED' ? (
          <form action={formAction}>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="PUBLISHED" />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
              {t('Publier sur la boutique')}
            </Button>
          </form>
        ) : null}

        {status !== 'HIDDEN' ? (
          <form action={formAction}>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="HIDDEN" />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              <EyeOff className="size-4" aria-hidden /> {t('Masquer')}
            </Button>
          </form>
        ) : null}
      </div>

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        {/* Répondre ne change pas le statut : un avis publié le reste. */}
        <input type="hidden" name="status" value={status} />
        <label className="block text-xs font-semibold text-navy-700" htmlFor={`reply-${id}`}>
          {t('Réponse publique de la boutique (facultatif)')}
        </label>
        <Textarea
          id={`reply-${id}`}
          name="reply"
          rows={2}
          maxLength={1000}
          defaultValue={reply ?? ''}
          placeholder={t('Ex. Merci pour ce retour : nous avons vérifié le stock restant avec vous.')}
        />
        <Button type="submit" size="sm" variant="ghost" disabled={pending}>
          <MessageSquareReply className="size-4" aria-hidden /> {t('Enregistrer la réponse')}
        </Button>
      </form>
    </div>
  );
}
