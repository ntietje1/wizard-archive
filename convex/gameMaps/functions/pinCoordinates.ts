import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'

const MIN_PIN_COORDINATE = 0
const MAX_PIN_COORDINATE = 100

export function assertPinCoordinate(value: number, axis: 'x' | 'y') {
  if (!Number.isFinite(value) || value < MIN_PIN_COORDINATE || value > MAX_PIN_COORDINATE) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Pin ${axis} coordinate must be between ${MIN_PIN_COORDINATE} and ${MAX_PIN_COORDINATE}`,
    )
  }
}
