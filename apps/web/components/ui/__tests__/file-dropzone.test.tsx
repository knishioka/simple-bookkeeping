import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { FileDropzone } from '../file-dropzone';

describe('FileDropzone', () => {
  const mockOnDrop = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render dropzone with default text', () => {
    render(<FileDropzone onDrop={mockOnDrop} />);

    expect(
      screen.getByText('ファイルをドラッグ&ドロップするか、クリックして選択')
    ).toBeInTheDocument();
    expect(screen.getByText('CSV形式のファイル（最大5MB）')).toBeInTheDocument();
  });

  it('should display selected file name', () => {
    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
    render(<FileDropzone onDrop={mockOnDrop} file={file} />);

    expect(screen.getByText(/選択中: test.csv/)).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    const { container } = render(<FileDropzone onDrop={mockOnDrop} disabled />);
    const dropzone = container.firstChild as HTMLElement;

    expect(dropzone).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  it('should call onDrop when file is dropped', async () => {
    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
    const { container } = render(<FileDropzone onDrop={mockOnDrop} />);
    const dropzone = container.firstChild as HTMLElement;

    // Simulate file drop
    const dataTransfer = {
      files: [file],
      items: [
        {
          kind: 'file',
          type: 'text/csv',
          getAsFile: () => file,
        },
      ],
      types: ['Files'],
    };

    await act(async () => {
      fireEvent.dragEnter(dropzone, { dataTransfer });
      fireEvent.dragOver(dropzone, { dataTransfer });
      fireEvent.drop(dropzone, { dataTransfer });
    });

    // Check if onDrop was called with the correct files
    await waitFor(() => {
      expect(mockOnDrop).toHaveBeenCalledTimes(1);
      expect(mockOnDrop).toHaveBeenCalledWith([file]);
    });
  });

  it('should show drag active state when dragging over', async () => {
    const { container } = render(<FileDropzone onDrop={mockOnDrop} />);
    const dropzone = container.firstChild as HTMLElement;

    const dataTransfer = {
      files: [],
      items: [
        {
          kind: 'file',
          type: 'text/csv',
        },
      ],
      types: ['Files'],
    };

    await act(async () => {
      fireEvent.dragEnter(dropzone, { dataTransfer });
    });

    await waitFor(() => {
      expect(screen.getByText('ファイルをドロップしてください')).toBeInTheDocument();
    });
  });

  it('should show reject state for invalid file types', async () => {
    const { container } = render(<FileDropzone onDrop={mockOnDrop} />);
    const dropzone = container.firstChild as HTMLElement;

    const dataTransfer = {
      files: [],
      items: [
        {
          kind: 'file',
          type: 'image/png',
        },
      ],
      types: ['Files'],
    };

    await act(async () => {
      fireEvent.dragEnter(dropzone, { dataTransfer });
    });

    await waitFor(() => {
      expect(screen.getByText('このファイルは対応していません')).toBeInTheDocument();
    });
  });

  it('should accept custom file types', () => {
    const customAccept = {
      'application/pdf': ['.pdf'],
    };

    render(<FileDropzone onDrop={mockOnDrop} accept={customAccept} />);

    // Component should render without errors
    expect(
      screen.getByText('ファイルをドラッグ&ドロップするか、クリックして選択')
    ).toBeInTheDocument();
  });

  it('should respect custom max size', () => {
    const customMaxSize = 10 * 1024 * 1024; // 10MB

    render(<FileDropzone onDrop={mockOnDrop} maxSize={customMaxSize} />);

    // Component should render without errors with custom max size
    expect(screen.getByText('CSV形式のファイル（最大5MB）')).toBeInTheDocument();
  });
});
