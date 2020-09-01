import React, { useState, useCallback, useEffect } from "react";
import { gql } from "apollo-boost";
import { useQuery } from "@apollo/react-hooks";
import { Snackbar } from "@rmwc/snackbar";

import { formatError } from "../util/error";
import * as models from "../models";
import { DataGrid, DataField, EnumTitleType } from "../Components/DataGrid";
import DataGridRow from "../Components/DataGridRow";
import { Dialog } from "../Components/Dialog";
import { DataTableCell } from "@rmwc/data-table";
import { Link } from "react-router-dom";
import NewEntity from "./NewEntity";

import "@rmwc/data-table/styles";

import UserAvatar from "../Components/UserAvatar";
import { Button, EnumButtonStyle } from "../Components/Button";

const fields: DataField[] = [
  {
    name: "lockedByUserId",
    title: "L",
    minWidth: true,
  },
  {
    name: "displayName",
    title: "Name",
    sortable: true,
  },
  {
    name: "description",
    title: "Description",
    sortable: true,
  },
  {
    name: "versionNumber",
    title: "Version",
  },
  {
    name: "lastCommitAt",
    title: "Last Commit",
  },
];

type TData = {
  entities: models.Entity[];
};

type sortData = {
  field: string | null;
  order: number | null;
};

type Props = {
  applicationId: string;
};

const NAME_FIELD = "displayName";

const INITIAL_SORT_DATA = {
  field: null,
  order: null,
};
const POLL_INTERVAL = 2000;

export const EntityList = ({ applicationId }: Props) => {
  const [sortDir, setSortDir] = useState<sortData>(INITIAL_SORT_DATA);

  const [searchPhrase, setSearchPhrase] = useState<string>("");
  const [newEntity, setNewEntity] = useState<boolean>(false);

  const handleSortChange = (fieldName: string, order: number | null) => {
    setSortDir({ field: fieldName, order: order === null ? 1 : order });
  };

  const handleSearchChange = (value: string) => {
    setSearchPhrase(value);
  };

  const handleNewEntityClick = useCallback(() => {
    setNewEntity(!newEntity);
  }, [newEntity, setNewEntity]);

  const { data, loading, error, stopPolling, startPolling } = useQuery<TData>(
    GET_ENTITIES,
    {
      variables: {
        id: applicationId,
        orderBy: {
          [sortDir.field || NAME_FIELD]:
            sortDir.order === 1 ? models.SortOrder.Desc : models.SortOrder.Asc,
        },
        whereName:
          searchPhrase !== ""
            ? { contains: searchPhrase, mode: models.QueryMode.Insensitive }
            : undefined,
      },
    }
  );

  //start polling with cleanup
  useEffect(() => {
    startPolling(POLL_INTERVAL);
    return () => {
      stopPolling();
    };
  }, [stopPolling, startPolling]);

  const errorMessage = formatError(error);

  return (
    <>
      <Dialog
        className="new-entity-dialog"
        isOpen={newEntity}
        onDismiss={handleNewEntityClick}
        title="New Entity"
      >
        <NewEntity applicationId={applicationId} />
      </Dialog>
      <DataGrid
        fields={fields}
        title="Entities"
        titleType={EnumTitleType.PageTitle}
        loading={loading}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        onSearchChange={handleSearchChange}
        toolbarContentEnd={
          <Button
            buttonStyle={EnumButtonStyle.Primary}
            onClick={handleNewEntityClick}
          >
            Create New
          </Button>
        }
      >
        {data?.entities.map((entity) => {
          const [latestVersion] = entity.entityVersions;

          return (
            <DataGridRow
              navigateUrl={`/${applicationId}/entities/${entity.id}`}
            >
              <DataTableCell className="min-width">
                {entity.lockedByUser && (
                  <UserAvatar
                    firstName={entity.lockedByUser.account?.firstName}
                    lastName={entity.lockedByUser.account?.lastName}
                  />
                )}
              </DataTableCell>
              <DataTableCell>
                <Link
                  className="amp-data-grid-item--navigate"
                  title={entity.displayName}
                  to={`/${applicationId}/entities/${entity.id}`}
                >
                  <span className="text-medium">{entity.displayName}</span>
                </Link>
              </DataTableCell>
              <DataTableCell>{entity.description}</DataTableCell>
              <DataTableCell>V{latestVersion.versionNumber}</DataTableCell>
              <DataTableCell>
                {latestVersion.commit && (
                  <UserAvatar
                    firstName={latestVersion.commit.user?.account?.firstName}
                    lastName={latestVersion.commit.user?.account?.lastName}
                  />
                )}
                <span className="text-medium space-before">
                  {latestVersion.commit?.message}{" "}
                </span>
                <span className="text-muted space-before">
                  {latestVersion.commit?.createdAt}
                </span>
              </DataTableCell>
            </DataGridRow>
          );
        })}
      </DataGrid>

      <Snackbar open={Boolean(error)} message={errorMessage} />
    </>
  );
  /**@todo: move error message to hosting page  */
};

/**@todo: expand search on other field  */
/**@todo: find a solution for case insensitive search  */
export const GET_ENTITIES = gql`
  query getEntities(
    $id: String!
    $orderBy: EntityOrderByInput
    $whereName: StringFilter
  ) {
    entities(
      where: { app: { id: $id }, displayName: $whereName }
      orderBy: $orderBy
    ) {
      id
      displayName
      description
      lockedByUserId
      lockedAt
      lockedByUser {
        account {
          firstName
          lastName
        }
      }
      entityVersions(take: 1, orderBy: { versionNumber: Desc }) {
        versionNumber
        commit {
          userId
          message
          createdAt
          user {
            id
            account {
              firstName
              lastName
            }
          }
        }
      }
    }
  }
`;
