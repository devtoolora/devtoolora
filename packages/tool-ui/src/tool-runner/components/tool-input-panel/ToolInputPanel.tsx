import {
  isCssDesignPreview,
  isToolFieldHidden,
  isToolFileMode,
  isToolInputHidden,
  resolveToolInputPresentation,
  type SerializedToolDefinition,
  type ToolField,
  type ToolInputPresentation,
  type ToolSample,
} from '@devtoolora/core';
import { Eraser, Link2, Play } from 'lucide-react';
import { useEffect, useState, type ReactElement, type ReactNode, type Ref } from 'react';
import { Button } from '../../../ui';
import { ToolFieldControl } from '../tool-field-control';
import type { ToolPanelDensity, ToolPlatformActions } from '../../types';
import styles from './ToolInputPanel.module.scss';
import { CssDesignControls, ImageCropEditor } from '../../editors';
import { textStatsLabel } from '../../utils/textStats';

type ToolInputPanelProps = {
  canRun: boolean;
  density?: ToolPanelDensity;
  fields: Record<string, string>;
  inputGutter?: ReactNode;
  isRunning: boolean;
  notice?: ReactNode;
  platformActions?: ToolPlatformActions;
  text: string;
  textareaRef?: Ref<HTMLTextAreaElement>;
  tool: SerializedToolDefinition;
  onClear(): void;
  onCopySettingsLink?(): Promise<boolean>;
  onFieldChange(fieldId: string, value: string): void;
  onRun(): void;
  onSampleApply(sample: ToolSample): void;
  onTextChange(value: string): void;
};

type InputMode = {
  isDecoding: boolean;
  isFileMode: boolean;
  presentation: ToolInputPresentation | undefined;
};

function inputLabelFor(tool: SerializedToolDefinition, mode: InputMode): string {
  const conversion = tool.textConversion;
  let inputLabel =
    mode.presentation?.label ?? (tool.inputKind === 'optionalText' ? 'Text (optional)' : 'Text');

  if (conversion) inputLabel = mode.isDecoding ? conversion.encodedLabel : conversion.decodedLabel;
  if (mode.isFileMode) inputLabel = 'Base64 / Data URI';

  return inputLabel;
}

function runLabelFor(tool: SerializedToolDefinition, mode: InputMode): string {
  const conversion = tool.textConversion;
  let runLabel = `Run ${tool.name}`;

  if (conversion)
    runLabel =
      conversion.runLabels?.[mode.isDecoding ? 'decode' : 'encode'] ??
      `${mode.isDecoding ? 'Decode' : 'Encode'} ${mode.isFileMode ? 'file' : 'input'}`;

  return runLabel;
}

type InputPanelActionsProps = {
  linkStatus: string;
  samples?: ToolSample[];
  onClear(): void;
  onCopySettingsLink?(): void;
  onSampleApply(sample: ToolSample): void;
};

function InputPanelActions({
  linkStatus,
  samples,
  onClear,
  onCopySettingsLink,
  onSampleApply,
}: InputPanelActionsProps): ReactElement {
  return (
    <div className={styles.panelActions} data-testid="panel-actions">
      {!!samples?.length && (
        <select
          aria-label="Apply sample"
          className={styles.sampleSelect}
          value=""
          onChange={(event) => {
            const sample = samples?.[Number(event.target.value)];

            if (sample) onSampleApply(sample);
          }}
        >
          <option value="">Samples…</option>
          {samples.map((sample, index) => (
            <option key={sample.label} value={index}>
              {sample.label}
            </option>
          ))}
        </select>
      )}
      {onCopySettingsLink && (
        <>
          <Button
            size="sm"
            title="Copies a link with the current options. Your input is not included."
            variant="ghost"
            onClick={onCopySettingsLink}
          >
            <Link2 size={14} />
            {linkStatus || 'Copy settings link'}
          </Button>
          <span aria-live="polite" className={styles.srOnly}>
            {linkStatus}
          </span>
        </>
      )}
      <Button size="sm" variant="ghost" onClick={onClear}>
        <Eraser size={14} />
        Clear
      </Button>
    </div>
  );
}

const densityClasses: Record<ToolPanelDensity, string> = {
  comfortable: '',
  compact: styles.inputPanelCompact ?? '',
};

const baseColorField: ToolField = {
  // Must match what the palette tool runs for an empty input.
  defaultValue: '#2563eb',
  id: 'base',
  label: 'Base color',
  placeholder: '#2563eb, rgb(37, 99, 235), hsl(221, 83%, 53%)',
  presentation: 'color',
  type: 'text',
};

type ToolSettingsProps = {
  fields: Record<string, string>;
  platformActions?: ToolPlatformActions;
  tool: SerializedToolDefinition;
  onFieldChange(fieldId: string, value: string): void;
};

function ToolSettings({
  fields,
  platformActions,
  tool,
  onFieldChange,
}: ToolSettingsProps): ReactNode {
  if (isCssDesignPreview(tool.preview))
    return <CssDesignControls fields={fields} tool={tool} onFieldChange={onFieldChange} />;

  return tool.fields?.map((field) =>
    isToolFieldHidden(tool, field.id, fields) ? null : (
      <ToolFieldControl
        field={field}
        fileName={fields[`${field.id}Name`]}
        key={field.id}
        platformActions={platformActions}
        value={fields[field.id] ?? ''}
        onFileNameChange={(value) => onFieldChange(`${field.id}Name`, value)}
        onValueChange={(value) => onFieldChange(field.id, value)}
      />
    ),
  );
}

function useLinkStatus(): { linkStatus: string; showLinkResult(copied: boolean): void } {
  const [linkStatus, setLinkStatus] = useState('');

  useEffect(() => {
    if (!linkStatus) return;

    const timeout = window.setTimeout(() => setLinkStatus(''), 2000);

    return () => window.clearTimeout(timeout);
  }, [linkStatus]);

  return {
    linkStatus,
    showLinkResult: (copied) => setLinkStatus(copied ? 'Link copied' : 'Copy failed'),
  };
}

type PrimaryTextInputProps = {
  gutter?: ReactNode;
  label: string;
  placeholder: string;
  text: string;
  textareaRef?: Ref<HTMLTextAreaElement>;
  onTextChange(value: string): void;
};

function PrimaryTextInput({
  gutter,
  label,
  placeholder,
  text,
  textareaRef,
  onTextChange,
}: PrimaryTextInputProps): ReactElement {
  return (
    <label className={`${styles.primaryInput} tool-field`} data-testid="primary-input">
      <span>{label}</span>
      <div className={styles.editorPane}>
        {gutter}
        <textarea
          autoCapitalize="off"
          placeholder={placeholder}
          ref={textareaRef}
          spellCheck={false}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </div>
    </label>
  );
}

type InputPanelBodyProps = {
  inputLabel: string;
  panel: ToolInputPanelProps;
  presentation: ReturnType<typeof resolveToolInputPresentation>;
};

function InputPanelBody({ inputLabel, panel, presentation }: InputPanelBodyProps): ReactElement {
  const conversion = panel.tool.textConversion;
  const isColorPalette = panel.tool.preview === 'color-palette';
  const hasTextInput = !isColorPalette && panel.tool.inputKind !== 'none';

  const settings = (
    <ToolSettings
      fields={panel.fields}
      platformActions={panel.platformActions}
      tool={panel.tool}
      onFieldChange={panel.onFieldChange}
    />
  );

  return (
    <div className={`${styles.panelBody} panel-body`}>
      {panel.notice}
      {conversion && settings}
      {isColorPalette && (
        <ToolFieldControl
          field={baseColorField}
          value={panel.text}
          onValueChange={panel.onTextChange}
        />
      )}

      {hasTextInput && !isToolInputHidden(panel.tool, panel.fields) && (
        <PrimaryTextInput
          gutter={panel.inputGutter}
          label={inputLabel}
          placeholder={
            conversion
              ? `Paste ${inputLabel.toLowerCase()} here…`
              : (presentation?.placeholder ?? 'Paste or type input here...')
          }
          text={panel.text}
          textareaRef={panel.textareaRef}
          onTextChange={panel.onTextChange}
        />
      )}
      {hasTextInput && panel.text && (
        <small aria-live="off" className={styles.inputStats} data-testid="input-stats">
          {textStatsLabel(panel.text)}
        </small>
      )}
      {!conversion && settings}
      {panel.tool.preview === 'image' && Boolean(panel.fields.image) && (
        <ImageCropEditor fields={panel.fields} onFieldChange={panel.onFieldChange} />
      )}
    </div>
  );
}

export function ToolInputPanel(props: ToolInputPanelProps): ReactElement {
  const isDecoding = props.fields.mode === 'decode';
  const isFileMode = isToolFileMode(props.tool, props.fields);
  const presentation = resolveToolInputPresentation(props.tool, props.fields);
  const { linkStatus, showLinkResult } = useLinkStatus();
  const mode: InputMode = { isDecoding, isFileMode, presentation };

  return (
    <section
      aria-labelledby="input-title"
      className={`${styles.inputPanel} ${densityClasses[props.density ?? 'comfortable']} ${props.tool.inputKind === 'none' ? styles.inputPanelFieldsOnly : ''} workspace-panel`}
      data-testid="input-panel"
    >
      <div className={styles.panelHeading}>
        <div>
          <span>Input</span>
          <h2 id="input-title">Source data</h2>
        </div>
        <InputPanelActions
          linkStatus={linkStatus}
          samples={props.tool.samples}
          onClear={props.onClear}
          onCopySettingsLink={
            props.onCopySettingsLink &&
            (() => void props.onCopySettingsLink?.().then(showLinkResult))
          }
          onSampleApply={props.onSampleApply}
        />
      </div>
      <InputPanelBody
        inputLabel={inputLabelFor(props.tool, mode)}
        panel={props}
        presentation={presentation}
      />
      {!props.tool.autoRun && (
        <button
          className={styles.runToolButton}
          data-testid="run-tool-button"
          disabled={props.isRunning || !props.canRun}
          type="button"
          onClick={props.onRun}
        >
          <Play fill="currentColor" size={16} />
          {props.isRunning ? 'Running…' : runLabelFor(props.tool, mode)}
        </button>
      )}
    </section>
  );
}
