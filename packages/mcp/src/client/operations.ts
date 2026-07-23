/**
 * GraphQL documents for the dashboard API the tools call
 * (docs/features/mcp-server.md §4.2). Handwritten template literals for Phase 1;
 * they can later import field selections from `@feedock/core`'s entity ops.
 *
 * Field selections mirror the public-safe projection (counts not emails,
 * display-name only). Note the API field name differences the mappers normalize:
 *   - Feedback status is `userStatus` (aliased here to `status`).
 *   - Feedback/Roadmap/Changelog rich-text fields are returned **raw** — the tool
 *     mapper sanitizes them before output (§5.3), never here.
 *
 * Variable shapes match the resolver `@Args` exactly:
 *   - list queries take a single `filter` input object;
 *   - id lookups take `id` (or `feedbackId`/`taskId`) of GraphQL type `ID!`;
 *   - mutations take a single `input` object (except the few `(id, …)` ones).
 */

// --- Feedback ---------------------------------------------------------------

export const FEEDBACK_LIST_QUERY = /* GraphQL */ `
  query FeedbackList($filter: FeedbackFilterInput) {
    feedbackList(filter: $filter) {
      id
      title
      status: userStatus
      kind
      voteCount
      requesterCount
      visibility
      roadmapItemId
      createdAt
    }
  }
`;

export const FEEDBACK_ITEM_QUERY = /* GraphQL */ `
  query FeedbackItem($id: ID!) {
    feedbackItem(id: $id) {
      id
      title
      body
      status: userStatus
      kind
      voteCount
      requesterCount
      visibility
      roadmapItemId
      createdAt
    }
  }
`;

export const FEEDBACK_COMMENTS_QUERY = /* GraphQL */ `
  query FeedbackComments($feedbackId: ID!) {
    feedbackComments(feedbackId: $feedbackId) {
      id
      body
      isOfficial
      authorName
      createdAt
    }
  }
`;

export const UPDATE_FEEDBACK_STATUS_MUTATION = /* GraphQL */ `
  mutation UpdateFeedbackStatus($input: UpdateFeedbackStatusInput!) {
    updateFeedbackStatus(input: $input) {
      id
      title
      status: userStatus
      kind
      voteCount
      requesterCount
      visibility
      roadmapItemId
      createdAt
    }
  }
`;

export const ADD_FEEDBACK_COMMENT_MUTATION = /* GraphQL */ `
  mutation AddFeedbackComment($input: AddCommentInput!) {
    addFeedbackComment(input: $input) {
      id
      body
      isOfficial
      authorName
      createdAt
    }
  }
`;

export const MERGE_FEEDBACK_MUTATION = /* GraphQL */ `
  mutation MergeFeedback($input: MergeFeedbackInput!) {
    mergeFeedback(input: $input) {
      id
      title
      status: userStatus
      kind
      voteCount
      requesterCount
      visibility
      roadmapItemId
      createdAt
    }
  }
`;

// --- Roadmap ----------------------------------------------------------------

const ROADMAP_FIELDS = /* GraphQL */ `
  id
  title
  description
  column
  visibility
  targetWindow
  milestoneId
  peopleAsked
  feedbackCount
  taskCount
  shippedAt
`;

export const ROADMAP_ITEMS_QUERY = /* GraphQL */ `
  query RoadmapItems {
    roadmapItems {
      ${ROADMAP_FIELDS}
    }
  }
`;

export const ROADMAP_ITEM_QUERY = /* GraphQL */ `
  query RoadmapItem($id: ID!) {
    roadmapItem(id: $id) {
      ${ROADMAP_FIELDS}
      linkedTasks {
        id
        number
        title
        status
        priority
      }
      linkedFeedback {
        id
        title
        requesterCount
        userStatus
      }
    }
  }
`;

export const CREATE_ROADMAP_ITEM_MUTATION = /* GraphQL */ `
  mutation CreateRoadmapItem($input: CreateRoadmapItemInput!) {
    createRoadmapItem(input: $input) {
      ${ROADMAP_FIELDS}
    }
  }
`;

export const UPDATE_ROADMAP_ITEM_MUTATION = /* GraphQL */ `
  mutation UpdateRoadmapItem($input: UpdateRoadmapItemInput!) {
    updateRoadmapItem(input: $input) {
      ${ROADMAP_FIELDS}
    }
  }
`;

export const MOVE_ROADMAP_ITEM_MUTATION = /* GraphQL */ `
  mutation MoveRoadmapItem($input: MoveRoadmapItemInput!) {
    moveRoadmapItem(input: $input) {
      ${ROADMAP_FIELDS}
    }
  }
`;

export const CONVERT_FEEDBACK_TO_ROADMAP_MUTATION = /* GraphQL */ `
  mutation ConvertFeedbackToRoadmap($input: ConvertFeedbackInput!) {
    convertFeedbackToRoadmap(input: $input) {
      ${ROADMAP_FIELDS}
    }
  }
`;

// --- Tasks ------------------------------------------------------------------

const TASK_FIELDS = /* GraphQL */ `
  id
  number
  title
  description
  status
  priority
  assigneeId
  milestoneId
  roadmapItemId
  dueDate
  completedAt
  createdAt
`;

export const TASKS_QUERY = /* GraphQL */ `
  query Tasks($filter: TaskFilterInput) {
    tasks(filter: $filter) {
      ${TASK_FIELDS}
    }
  }
`;

export const TASK_QUERY = /* GraphQL */ `
  query Task($id: ID!) {
    task(id: $id) {
      ${TASK_FIELDS}
      gitRefs {
        id
        provider
        refType
        externalId
        url
        title
        state
        authorLogin
      }
      subtasks {
        id
        number
        title
        status
      }
    }
  }
`;

export const TASK_ACTIVITY_QUERY = /* GraphQL */ `
  query TaskActivity($taskId: ID!) {
    taskActivity(taskId: $taskId) {
      id
      type
      field
      fromValue
      toValue
      actorName
      createdAt
    }
  }
`;

export const CREATE_TASK_MUTATION = /* GraphQL */ `
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

export const UPDATE_TASK_STATUS_MUTATION = /* GraphQL */ `
  mutation UpdateTaskStatus($input: UpdateTaskStatusInput!) {
    updateTaskStatus(input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

export const UPDATE_TASK_MUTATION = /* GraphQL */ `
  mutation UpdateTask($input: UpdateTaskInput!) {
    updateTask(input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

export const DELETE_TASK_MUTATION = /* GraphQL */ `
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;

export const CONVERT_FEEDBACK_TO_TASK_MUTATION = /* GraphQL */ `
  mutation ConvertFeedbackToTask($input: ConvertFeedbackToTaskInput!) {
    convertFeedbackToTask(input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

// --- Milestones -------------------------------------------------------------

const MILESTONE_FIELDS = /* GraphQL */ `
  id
  title
  description
  status
  visibility
  progressPct
  taskCount
  doneTaskCount
  ownerId
  startDate
  softTargetDate
  softTargetPrecision
`;

export const MILESTONES_QUERY = /* GraphQL */ `
  query Milestones {
    milestones {
      ${MILESTONE_FIELDS}
    }
  }
`;

export const MILESTONE_QUERY = /* GraphQL */ `
  query Milestone($id: ID!) {
    milestone(id: $id) {
      ${MILESTONE_FIELDS}
      tasks {
        id
        number
        title
        status
        priority
      }
      roadmapItems {
        id
        title
        column
        visibility
      }
      docs {
        id
        title
        slug
        type
        customTypeName
        visibility
        updatedAt
      }
    }
  }
`;

/**
 * Just the visibility — the update tool's PUBLIC gate has to know whether the
 * milestone is ALREADY public (editing live public copy is a public write), and
 * pulling the full `milestone(id)` detail (tasks + roadmap items + docs) to read
 * one enum would be wasteful.
 */
export const MILESTONE_VISIBILITY_QUERY = /* GraphQL */ `
  query MilestoneVisibility($id: ID!) {
    milestone(id: $id) {
      id
      visibility
    }
  }
`;

export const CREATE_MILESTONE_MUTATION = /* GraphQL */ `
  mutation CreateMilestone($input: CreateMilestoneInput!) {
    createMilestone(input: $input) {
      ${MILESTONE_FIELDS}
    }
  }
`;

export const UPDATE_MILESTONE_MUTATION = /* GraphQL */ `
  mutation UpdateMilestone($input: UpdateMilestoneInput!) {
    updateMilestone(input: $input) {
      ${MILESTONE_FIELDS}
    }
  }
`;

// --- Changelog --------------------------------------------------------------

const CHANGELOG_FIELDS = /* GraphQL */ `
  id
  title
  body: bodyMarkdown
  whyItMatters
  category
  state
  visibility
  slug
  publishedAt
  requesterCount
`;

export const CHANGELOG_ENTRIES_QUERY = /* GraphQL */ `
  query ChangelogEntries {
    changelogEntries {
      ${CHANGELOG_FIELDS}
      roadmapItemIds
      sourceFeedbackIds
    }
  }
`;

export const CHANGELOG_ENTRY_QUERY = /* GraphQL */ `
  query ChangelogEntry($id: ID!) {
    changelogEntry(id: $id) {
      ${CHANGELOG_FIELDS}
      roadmapItemIds
      sourceFeedbackIds
    }
  }
`;

export const CHANGELOG_PUBLISH_PREVIEW_QUERY = /* GraphQL */ `
  query ChangelogPublishPreview($id: ID!) {
    changelogPublishPreview(id: $id) {
      requesterCount
      subscriberCount
      roadmapItemCount
      firstPublish
      previewToken
    }
  }
`;

export const CREATE_CHANGELOG_ENTRY_MUTATION = /* GraphQL */ `
  mutation CreateChangelogEntry($input: CreateChangelogEntryInput!) {
    createChangelogEntry(input: $input) {
      ${CHANGELOG_FIELDS}
      roadmapItemIds
      sourceFeedbackIds
    }
  }
`;

export const UPDATE_CHANGELOG_STATE_MUTATION = /* GraphQL */ `
  mutation UpdateChangelogState($input: UpdateChangelogStateInput!) {
    updateChangelogState(input: $input) {
      ${CHANGELOG_FIELDS}
      roadmapItemIds
      sourceFeedbackIds
    }
  }
`;

// --- Docs -------------------------------------------------------------------

export const DOCS_QUERY = /* GraphQL */ `
  query Docs($filter: DocFilterInput) {
    docs(filter: $filter) {
      id
      title
      slug
      type
      customTypeName
      visibility
      milestoneId
      updatedAt
    }
  }
`;

const DOC_FIELDS = /* GraphQL */ `
  id
  title
  slug
  type
  customTypeName
  body
  visibility
  milestoneId
  updatedAt
`;

export const DOC_QUERY = /* GraphQL */ `
  query Doc($id: ID!) {
    doc(id: $id) {
      ${DOC_FIELDS}
    }
  }
`;

export const CREATE_DOC_MUTATION = /* GraphQL */ `
  mutation CreateDoc($input: CreateDocInput!) {
    createDoc(input: $input) {
      ${DOC_FIELDS}
    }
  }
`;

export const UPDATE_DOC_MUTATION = /* GraphQL */ `
  mutation UpdateDoc($input: UpdateDocInput!) {
    updateDoc(input: $input) {
      ${DOC_FIELDS}
    }
  }
`;

export const DELETE_DOC_MUTATION = /* GraphQL */ `
  mutation DeleteDoc($id: ID!) {
    deleteDoc(id: $id)
  }
`;

// --- Projects (user-scoped tokens only) --------------------------------------

export const MCP_PROJECTS_QUERY = /* GraphQL */ `
  query McpProjects {
    mcpProjects {
      id
      name
      slug
      readOnly
    }
  }
`;

// --- Projects (any token) ----------------------------------------------------

/**
 * The project this token already works in. Unlike `mcpProjects` this names ONE
 * project — the caller's own — so a project-bound token may ask, and must be
 * able to: it is otherwise the one caller that cannot find out which board it is
 * about to write to.
 */
export const CURRENT_PROJECT_QUERY = /* GraphQL */ `
  query CurrentProject {
    currentProject {
      id
      name
      slug
    }
  }
`;
