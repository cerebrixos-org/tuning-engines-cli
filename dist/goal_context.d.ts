export interface GoalContext {
    work_item_id?: string;
    outcome_context_id?: string;
    title: string;
    outcome_key?: string;
    goal_key?: string;
    project_dir: string;
    source_session_hash: string;
}
export declare function sourceSessionHash(projectDir?: string): string;
export declare function loadGoalContext(projectDir?: string): GoalContext | undefined;
export declare function saveGoalContext(context: GoalContext): void;
export declare function clearGoalContext(projectDir?: string): void;
export declare function goalMetadata(projectDir?: string, fallbackSessionId?: string): Record<string, string>;
//# sourceMappingURL=goal_context.d.ts.map