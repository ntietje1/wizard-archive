export function testId<TTableName extends string>(
  id: string,
): string & {
  __tableName: TTableName
} {
  return id as string & { __tableName: TTableName }
}
