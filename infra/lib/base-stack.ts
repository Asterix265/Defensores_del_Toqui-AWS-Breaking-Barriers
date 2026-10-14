import { Stack, Tags, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

/**
 * Stack de marcador. Los recursos reales (datos, almacenamiento, auth, api, pipeline, web)
 * se agregan en cambios posteriores, según openspec/changes/definir-mvp-e1/design.md.
 */
export class BaseStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    Tags.of(this).add('proyecto', 'defensores-del-toqui');
    Tags.of(this).add('evento', 'aws-breaking-barriers-2026');
  }
}
