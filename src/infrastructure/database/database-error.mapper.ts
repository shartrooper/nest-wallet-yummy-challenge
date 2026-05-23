import { 
  ConflictException, 
  BadRequestException, 
  InternalServerErrorException,
  UnprocessableEntityException
} from '@nestjs/common';

export class DatabaseErrorMapper {
  static map(error: any): Error {
    // Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
    
    switch (error.code) {
      case '23505': // unique_violation
        return new ConflictException('Resource already exists');
      
      case '23514': // check_violation
        if (error.constraint === 'positive_balance') {
          return new UnprocessableEntityException('Insufficient funds');
        }
        return new BadRequestException('Database constraint violation');

      case '23503': // foreign_key_violation
        return new BadRequestException('Related resource not found');

      default:
        return new InternalServerErrorException('An unexpected database error occurred');
    }
  }
}
