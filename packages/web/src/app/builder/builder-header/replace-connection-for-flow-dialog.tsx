import {
  AppConnectionReplaceScope,
  flowStructureUtil,
} from '@activepieces/shared';
import { useMutation } from '@tanstack/react-query';
import { t } from 'i18next';
import { Info } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useBuilderStateContext } from '@/app/builder/builder-hooks';
import {
  ReplaceConnectionSelection,
  ReplaceConnectionSelectionFields,
  replaceConnectionSelectionUtils,
  ReplaceConnectionVersionsField,
} from '@/app/connections/replace-connection-selection-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { internalErrorToast } from '@/components/ui/sonner';
import {
  appConnectionsMutations,
  appConnectionsQueries,
} from '@/features/connections';
import { piecesHooks } from '@/features/pieces';
import { authenticationSession } from '@/lib/authentication-session';

const ReplaceConnectionForFlowDialog = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('Replace connection')}</DialogTitle>
          <DialogDescription>
            {t(
              'Switch the steps of this flow from one connection to another. Other flows are not changed.',
            )}
          </DialogDescription>
        </DialogHeader>
        <ReplaceConnectionForFlowForm
          key={dialogOpen ? 'open' : 'closed'}
          setDialogOpen={setDialogOpen}
        />
      </DialogContent>
    </Dialog>
  );
};

function ReplaceConnectionForFlowForm({
  setDialogOpen,
}: {
  setDialogOpen: (open: boolean) => void;
}) {
  const [flow, flowVersion, savePendingEdits, refreshDraft] =
    useBuilderStateContext((state) => [
      state.flow,
      state.flowVersion,
      state.savePendingEdits,
      state.refreshDraft,
    ]);
  const projectId = authenticationSession.getProjectId()!;
  const { pieces, isLoading: piecesLoading } = piecesHooks.usePieces({});
  const { data: connections, isLoading: connectionsLoading } =
    appConnectionsQueries.useAppConnections({
      request: { projectId, limit: 1000 },
      extraKeys: [projectId],
      staleTime: 0,
    });
  const { mutateAsync: replaceConnections } =
    appConnectionsMutations.useReplaceConnections({
      setDialogOpen,
      refetch: () => {
        refreshDraft().catch(() => internalErrorToast());
      },
    });
  const { mutate: saveEditsThenReplace, isPending: isReplacing } = useMutation({
    mutationFn: async (values: FlowReplaceFormValues) => {
      await savePendingEdits();
      await replaceConnections({
        scope: AppConnectionReplaceScope.FLOW,
        flowIds: [flow.id],
        projectId,
        sourceAppConnectionId: values.sourceConnectionId,
        targetAppConnectionId: values.targetConnectionId,
        applyToPublishedVersions: values.applyToPublishedVersions,
      });
    },
  });
  const form = useForm<FlowReplaceFormValues>({
    defaultValues: {
      ...replaceConnectionSelectionUtils.emptySelection(),
      applyToPublishedVersions: false,
    },
    mode: 'onSubmit',
  });

  const projectConnections = connections?.data ?? [];
  const flowConnectionExternalIds =
    flowStructureUtil.extractConnectionIds(flowVersion);
  const flowConnections = projectConnections.filter((connection) =>
    flowConnectionExternalIds.includes(connection.externalId),
  );
  const flowPieceNames = new Set(
    flowConnections.map((connection) => connection.pieceName),
  );
  const flowPieces =
    pieces?.filter((piece) => flowPieceNames.has(piece.name)) ?? [];

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => saveEditsThenReplace(values))}
        className="flex flex-col gap-4"
      >
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            {t(
              'Steps that use the replaced connection keep their settings. Test your flow to make sure nothing breaks.',
            )}
          </AlertDescription>
        </Alert>
        <ReplaceConnectionSelectionFields
          pieces={flowPieces}
          sourceConnections={flowConnections}
          targetConnections={projectConnections}
          loading={piecesLoading || connectionsLoading}
        />
        <ReplaceConnectionVersionsField />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              {t('Cancel')}
            </Button>
          </DialogClose>
          <Button type="submit" loading={isReplacing}>
            {t('Replace')}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

ReplaceConnectionForFlowDialog.displayName = 'ReplaceConnectionForFlowDialog';
export { ReplaceConnectionForFlowDialog };

type FlowReplaceFormValues = ReplaceConnectionSelection & {
  applyToPublishedVersions: boolean;
};
