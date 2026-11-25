import type { ToolField } from '@devtoolora/core';
import { useId, useRef, useState, type ReactElement, type RefObject } from 'react';
import { ColorFieldControl } from './ColorFieldControl';
import { countSelectedFiles } from './countSelectedFiles';
import { RangeFieldControl } from './RangeFieldControl';
import { readFile } from './readFile';
import { bytesText } from '../../utils/bytesText';
import { dataUriByteLength } from '../../utils/dataUri';
import { takePickedFiles } from '../../utils/takePickedFiles';
import type { FileToolField, PickedToolFile, ToolPlatformActions } from '../../types';
import styles from './ToolFieldControl.module.scss';

type ToolFieldControlProps = {
  field: ToolField;
  fileName?: string;
  platformActions?: ToolPlatformActions;
  value: string;
  onFileNameChange?(value: string): void;
  onValueChange(value: string): void;
};

function applyFiles(
  field: FileToolField,
  files: PickedToolFile[],
  onValueChange: (value: string) => void,
  onFileNameChange?: (value: string) => void,
) {
  onValueChange(field.multiple ? JSON.stringify(files) : (files[0]?.data ?? ''));

  onFileNameChange?.(
    field.multiple ? files.map((file) => file.name).join(', ') : (files[0]?.name ?? ''),
  );
}

// Lowercases only a leading word, so acronyms such as SVG or PDF keep their case.
function midSentenceLabel(label: string): string {
  return /^[A-Z][A-Z]/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

function selectedFilesLabel(value: string, fileName?: string): string {
  const count = countSelectedFiles(value);
  const label = `${count} file${count === 1 ? '' : 's'} selected`;

  return fileName ? `${label} · ${fileName}` : label;
}

type BasicToolField = Exclude<ToolField, { type: 'checkboxGroup' | 'select' }>;
type GroupToolField = Extract<ToolField, { type: 'checkboxGroup' }>;
type SelectToolField = Extract<ToolField, { type: 'select' }>;

type FieldProps<Field extends ToolField> = {
  field: Field;
  helpId?: string;
  value: string;
  onValueChange(value: string): void;
};

function FieldHelp({ field, id }: { field: ToolField; id?: string }): ReactElement | null {
  return field.help ? <small id={id}>{field.help}</small> : null;
}

function CheckboxField({
  field,
  helpId,
  value,
  onValueChange,
}: FieldProps<BasicToolField>): ReactElement {
  return (
    <div className={`${styles.field} tool-field`}>
      <label className={styles.checkbox} data-testid="tool-checkbox">
        <input
          aria-describedby={helpId}
          checked={value === 'true'}
          type="checkbox"
          onChange={(event) => onValueChange(String(event.target.checked))}
        />
        <span>{field.label}</span>
      </label>
      <FieldHelp field={field} id={helpId} />
    </div>
  );
}

function CheckboxGroupField({
  field,
  helpId,
  value,
  onValueChange,
}: FieldProps<GroupToolField>): ReactElement {
  const selected = new Set(value.split(',').filter(Boolean));

  return (
    <fieldset
      aria-describedby={helpId}
      className={`${styles.field} ${styles.checkboxGroup} tool-field tool-checkbox-group`}
    >
      <legend>{field.label}</legend>
      {field.options.map((option) => (
        <label key={option.value}>
          <input
            checked={selected.has(option.value)}
            type="checkbox"
            onChange={(event) => {
              const next = new Set(selected);

              if (event.target.checked) next.add(option.value);
              else next.delete(option.value);

              onValueChange([...next].join(','));
            }}
          />
          {option.label}
        </label>
      ))}
      <FieldHelp field={field} id={helpId} />
    </fieldset>
  );
}

function SegmentedField({
  field,
  helpId,
  value,
  onValueChange,
}: FieldProps<SelectToolField>): ReactElement {
  return (
    <div className={`${styles.field} tool-field`}>
      <span>{field.label}</span>
      <div
        aria-describedby={helpId}
        aria-label={field.label}
        className={`${styles.segmentedControl} tool-segmented-control`}
        role="group"
      >
        {field.options.map((option) => (
          <button
            aria-pressed={value === option.value}
            key={option.value}
            type="button"
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <FieldHelp field={field} id={helpId} />
    </div>
  );
}

function SearchableSelectField({
  field,
  helpId,
  listId,
  value,
  onValueChange,
}: FieldProps<SelectToolField> & { listId: string }): ReactElement {
  return (
    <label className={`${styles.field} tool-field`}>
      <span>{field.label}</span>
      <input
        aria-describedby={helpId}
        aria-label={field.label}
        list={listId}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <datalist id={listId}>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
      <FieldHelp field={field} id={helpId} />
    </label>
  );
}

function SelectField({
  field,
  helpId,
  value,
  onValueChange,
}: FieldProps<SelectToolField>): ReactElement {
  return (
    <label className={`${styles.field} tool-field`}>
      <span>{field.label}</span>
      <select
        aria-describedby={helpId}
        aria-label={field.label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldHelp field={field} id={helpId} />
    </label>
  );
}

function TextField({
  field,
  helpId,
  value,
  onValueChange,
}: FieldProps<BasicToolField>): ReactElement {
  const InputComponent = field.type === 'textarea' ? 'textarea' : 'input';

  return (
    <label className={`${styles.field} tool-field`}>
      <span>{field.label}</span>
      <InputComponent
        aria-describedby={helpId}
        aria-label={field.label}
        autoComplete={field.type === 'password' ? 'new-password' : undefined}
        max={field.type === 'number' ? field.range?.max : undefined}
        min={field.type === 'number' ? field.range?.min : undefined}
        placeholder={field.placeholder}
        rows={field.type === 'textarea' ? field.rows : undefined}
        step={field.type === 'number' ? field.range?.step : undefined}
        type={field.type === 'textarea' ? undefined : field.type}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <FieldHelp field={field} id={helpId} />
    </label>
  );
}

type FileFieldReader = {
  error: string;
  labelRef: RefObject<HTMLLabelElement | null>;
  pickNative(field: FileToolField): Promise<void>;
  prefersBrowserPicker: boolean;
  readFileList(field: FileToolField, fileList: Iterable<File> | null): Promise<void>;
};

// Called by ToolFieldControl, not FileField, so the state survives a field id that switches
// between file and text types across tools.
function useFileFieldReader(
  platformActions: ToolPlatformActions | undefined,
  onValueChange: (value: string) => void,
  onFileNameChange: ((value: string) => void) | undefined,
): FileFieldReader {
  const [fileError, setFileError] = useState('');
  const [useBrowserFilePicker, setUseBrowserFilePicker] = useState(false);
  const fileFieldRef = useRef<HTMLLabelElement>(null);
  const fileReadRevision = useRef(0);

  const isCurrent = (revision: number): boolean =>
    revision === fileReadRevision.current && Boolean(fileFieldRef.current?.isConnected);

  const readFileList = async (field: FileToolField, fileList: Iterable<File> | null) => {
    const files = [...(fileList ?? [])].slice(0, field.multiple ? undefined : 1);

    if (!files.length) return;

    const revision = ++fileReadRevision.current;

    setFileError('');
    applyFiles(field, [], onValueChange, onFileNameChange);

    try {
      const maxBytes = field.maxBytes;

      if (maxBytes && files.some((file) => file.size > maxBytes)) {
        throw new Error(`File must be at most ${bytesText(maxBytes)}.`);
      }

      const entries = await Promise.all(
        files.map(async (file) => ({ data: await readFile(file), name: file.name })),
      );

      if (!isCurrent(revision)) return;

      applyFiles(field, entries, onValueChange, onFileNameChange);
    } catch (error) {
      if (!isCurrent(revision)) return;

      setFileError(error instanceof Error ? error.message : 'The selected file could not be read.');
    }
  };

  const pickNative = async (field: FileToolField) => {
    const revision = ++fileReadRevision.current;

    setFileError('');

    try {
      const files = await platformActions?.pickFiles?.(field);

      if (!isCurrent(revision)) return;
      if (files) applyFiles(field, files, onValueChange, onFileNameChange);
    } catch (error) {
      if (!isCurrent(revision)) return;

      applyFiles(field, [], onValueChange, onFileNameChange);
      setFileError(error instanceof Error ? error.message : 'The selected file could not be read.');
      setUseBrowserFilePicker(true);
    }
  };

  return {
    error: fileError,
    labelRef: fileFieldRef,
    pickNative,
    prefersBrowserPicker: useBrowserFilePicker,
    readFileList,
  };
}

type FileFieldProps = {
  error: string;
  field: FileToolField;
  fileName?: string;
  helpId?: string;
  labelRef: RefObject<HTMLLabelElement | null>;
  showsNativePicker: boolean;
  value: string;
  onFileList(fileList: Iterable<File> | null): void;
  onNativePick(): void;
};

function FileField({
  error,
  field,
  fileName,
  helpId,
  labelRef,
  showsNativePicker,
  value,
  onFileList,
  onNativePick,
}: FileFieldProps): ReactElement {
  const fileBytes = dataUriByteLength(value);
  // Also the button's aria-label, or the wrapping label, help and file name would name it.
  const pickText = `${value ? 'Choose different' : 'Choose'} ${midSentenceLabel(field.label)}…`;

  return (
    <label
      className={`${styles.field} ${styles.fileField} tool-field tool-file-field`}
      ref={labelRef}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onFileList(event.dataTransfer.files);
      }}
    >
      <span>{field.label}</span>
      {showsNativePicker ? (
        <button
          aria-describedby={helpId}
          aria-label={pickText}
          className="native-file-button"
          type="button"
          onClick={onNativePick}
        >
          {pickText}
        </button>
      ) : (
        <input
          accept={field.accept}
          aria-describedby={helpId}
          aria-label={field.label}
          multiple={field.multiple}
          type="file"
          onChange={(event) => onFileList(takePickedFiles(event))}
        />
      )}
      {value && (
        <small className={`${styles.selectedFileName} selected-file-name`}>
          {field.multiple ? selectedFilesLabel(value, fileName) : fileName || 'Sample file'}
          {!field.multiple && value.includes(',') && ` · ${fileBytes} bytes`}
        </small>
      )}
      <FieldHelp field={field} id={helpId} />
      {error && (
        <small className={styles.fieldError} role="alert">
          {error}
        </small>
      )}
    </label>
  );
}

export function ToolFieldControl({
  field,
  fileName,
  platformActions,
  value,
  onFileNameChange,
  onValueChange,
}: ToolFieldControlProps): ReactElement {
  const optionListId = useId();
  const helpId = useId();
  const describedBy = field.help ? helpId : undefined;
  const control = { helpId: describedBy, value, onValueChange };
  const fileReader = useFileFieldReader(platformActions, onValueChange, onFileNameChange);

  // A slider over a span above 10,000 (unit converter: 2,000,000) jumps by thousands per pixel.
  if (field.type === 'number' && field.range && field.range.max - field.range.min <= 10_000)
    return (
      <RangeFieldControl
        help={field.help}
        label={field.label}
        maximum={field.range.max}
        minimum={field.range.min}
        step={field.range.step}
        unit={field.range.unit}
        value={value}
        onValueChange={onValueChange}
      />
    );
  if (field.type === 'text' && field.presentation === 'color')
    return <ColorFieldControl field={field} value={value} onValueChange={onValueChange} />;
  if (field.type === 'checkbox') return <CheckboxField field={field} {...control} />;
  if (field.type === 'checkboxGroup') return <CheckboxGroupField field={field} {...control} />;

  if (field.type === 'select') {
    if (field.presentation === 'segmented') return <SegmentedField field={field} {...control} />;

    if (field.searchable)
      return <SearchableSelectField field={field} listId={optionListId} {...control} />;

    return <SelectField field={field} {...control} />;
  }

  if (field.type === 'file') {
    const fileField: FileToolField = { ...field, type: 'file' };

    return (
      <FileField
        error={fileReader.error}
        field={fileField}
        fileName={fileName}
        helpId={describedBy}
        labelRef={fileReader.labelRef}
        showsNativePicker={Boolean(platformActions?.pickFiles) && !fileReader.prefersBrowserPicker}
        value={value}
        onFileList={(fileList) => void fileReader.readFileList(fileField, fileList)}
        onNativePick={() => void fileReader.pickNative(fileField)}
      />
    );
  }

  return <TextField field={field} {...control} />;
}
